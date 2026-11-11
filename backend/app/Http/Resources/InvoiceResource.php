<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Invoice */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'number' => $this->number,
            'supplier_reference' => $this->supplier_reference,
            'partner' => $this->whenLoaded('partner', fn () => ['id' => $this->partner->id, 'name' => $this->partner->name]),
            'partner_id' => $this->partner_id,
            'invoice_date' => $this->invoice_date->toDateString(),
            'due_date' => $this->due_date->toDateString(),
            'status' => $this->status,
            'currency' => $this->currency,
            'subtotal' => $this->subtotal,
            'tax_total' => $this->tax_total,
            'total' => $this->total,
            'amount_paid' => Money::fromCents(Money::toCents($this->amount_paid ?? '0')),
            'amount_due' => Money::fromCents($this->amountDueCents()),
            'notes' => $this->notes,
            'journal_entry_id' => $this->journal_entry_id,
            'posted_at' => $this->posted_at?->toIso8601String(),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'account_id' => $line->account_id,
                'account' => $line->relationLoaded('account') && $line->account
                    ? ['id' => $line->account->id, 'code' => $line->account->code, 'name' => $line->account->name]
                    : null,
                'description' => $line->description,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'tax_rate' => $line->tax_rate,
                'net_amount' => $line->net_amount,
                'tax_amount' => $line->tax_amount,
            ])),
        ];
    }
}
