<?php

namespace App\Http\Requests;

use App\Models\FiscalYear;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FiscalYearRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:50',
                Rule::unique('fiscal_years', 'name')
                    ->where('company_id', $this->user()->company_id)
                    ->ignore($this->route('fiscal_year')?->id),
            ],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'status' => ['sometimes', Rule::in([FiscalYear::STATUS_OPEN, FiscalYear::STATUS_CLOSED])],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $overlaps = FiscalYear::query()
                ->whereKeyNot($this->route('fiscal_year')?->id)
                ->whereDate('starts_on', '<=', $this->input('ends_on'))
                ->whereDate('ends_on', '>=', $this->input('starts_on'))
                ->exists();

            if ($overlaps) {
                $validator->errors()->add('starts_on', 'Cet exercice chevauche un exercice existant.');
            }
        }];
    }
}
