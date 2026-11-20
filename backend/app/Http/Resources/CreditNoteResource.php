<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreditNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'supplier_reference' => $this->supplier_reference,
            'type' => $this->type,
            'status' => $this->status,
            'credit_note_date' => $this->credit_note_date?->toDateString(),
            'reason' => $this->reason,
            'notes' => $this->notes,
            'currency' => $this->currency,
            'subtotal' => $this->subtotal,
            'tax_total' => $this->tax_total,
            'total' => $this->total,
            'posted_at' => $this->posted_at,

            'invoice' => $this->whenLoaded('invoice', fn () => [
                'id' => $this->invoice->id,
                'number' => $this->invoice->number,
                'type' => $this->invoice->type,
                'status' => $this->invoice->status,
                'invoice_date' => $this->invoice->invoice_date,
                'total' => $this->invoice->total,
            ]),

            'partner' => $this->whenLoaded('partner', fn () => [
                'id' => $this->partner->id,
                'name' => $this->partner->name,
                'type' => $this->partner->type,
            ]),

            'lines' => CreditNoteLineResource::collection(
                $this->whenLoaded('lines')
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
