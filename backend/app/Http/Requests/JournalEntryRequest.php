<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JournalEntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $company = $this->user()->company_id;

        return [
            'journal_id' => ['required', 'integer', Rule::exists('journals', 'id')->where('company_id', $company)],
            'entry_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'lines' => ['required', 'array', 'min:2', 'max:500'],
            'lines.*.account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('company_id', $company)],
            'lines.*.label' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999999'],
            'lines.*.credit' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999999'],
        ];
    }
}
