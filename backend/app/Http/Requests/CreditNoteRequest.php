<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreditNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'invoice_id' => ['required', 'integer', 'exists:invoices,id'],
            'credit_note_date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:10000'],

            'lines' => ['required', 'array', 'min:1'],
            'lines.*.invoice_line_id' => ['required', 'integer', 'distinct'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'lines.*.unit_price' => ['required', 'numeric', 'gte:0', 'decimal:0,2'],
            'lines.*.tax_rate' => ['required', 'numeric', 'gte:0', 'lte:100', 'decimal:0,2'],
                  ];
    }

    public function messages(): array
    {
        return [
            'invoice_id.required' => 'La facture d’origine est obligatoire.',
            'credit_note_date.required' => 'La date de l’avoir est obligatoire.',
            'reason.required' => 'Le motif de l’avoir est obligatoire.',
            'lines.required' => 'Ajoutez au moins une ligne à l’avoir.',
            'lines.min' => 'Un avoir doit contenir au moins une ligne.',
            'lines.*.invoice_line_id.distinct' => 'Une même ligne de facture ne peut pas être ajoutée plusieurs fois.',
            'lines.*.quantity.gt' => 'La quantité doit être supérieure à zéro.',
        ];
    }
}
