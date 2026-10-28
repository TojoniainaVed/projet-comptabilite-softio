<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $company = $this->user()->company_id;

        return [
            // Le type est fixé à la création et ne peut plus changer ensuite.
            'type' => [$this->isMethod('POST') ? 'required' : 'prohibited', Rule::in([Invoice::TYPE_CUSTOMER, Invoice::TYPE_SUPPLIER])],
            'partner_id' => ['required', 'integer', Rule::exists('partners', 'id')->where('company_id', $company)],
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:invoice_date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:200'],
            'lines.*.account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('company_id', $company)],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999999'],
            'lines.*.unit_price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999999'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'decimal:0,2', 'between:0,100'],
        ];
    }
}
