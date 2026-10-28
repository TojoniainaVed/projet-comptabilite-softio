<?php

namespace App\Http\Requests;

use App\Models\Journal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JournalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => [
                'required', 'string', 'max:10', 'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('journals', 'code')
                    ->where('company_id', $this->user()->company_id)
                    ->ignore($this->route('journal')?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(Journal::TYPES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
