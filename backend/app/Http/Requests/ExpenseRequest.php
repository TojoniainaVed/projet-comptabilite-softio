<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $company = $this->user()->company_id;

        return [
            'expense_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999'],
            'account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('company_id', $company)],
            'paid_from_account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('company_id', $company)],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('company_id', $company)],
            'reference' => ['nullable', 'string', 'max:100'],
        ];
    }
}
