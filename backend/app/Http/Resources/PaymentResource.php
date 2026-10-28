<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Payment */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice' => $this->whenLoaded('invoice', fn () => [
                'id' => $this->invoice->id,
                'number' => $this->invoice->number,
                'type' => $this->invoice->type,
            ]),
            'invoice_id' => $this->invoice_id,
            'treasury_account' => $this->whenLoaded('treasuryAccount', fn () => [
                'id' => $this->treasuryAccount->id,
                'code' => $this->treasuryAccount->code,
                'name' => $this->treasuryAccount->name,
            ]),
            'amount' => $this->amount,
            'paid_on' => $this->paid_on->toDateString(),
            'method' => $this->method,
            'reference' => $this->reference,
            'journal_entry_id' => $this->journal_entry_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
