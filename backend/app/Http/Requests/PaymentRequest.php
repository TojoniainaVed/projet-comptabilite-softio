<?php

namespace App\Http\Requests;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999999'],
            'paid_on' => ['required', 'date'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'treasury_account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('company_id', $this->user()->company_id)],
            'reference' => ['nullable', 'string', 'max:100'],
        ];
    }
}
