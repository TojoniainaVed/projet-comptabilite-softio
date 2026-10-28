<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\JournalEntry */
class JournalEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'journal' => $this->whenLoaded('journal', fn () => ['id' => $this->journal->id, 'code' => $this->journal->code, 'name' => $this->journal->name]),
            'entry_date' => $this->entry_date->toDateString(),
            'description' => $this->description,
            'status' => $this->status,
            'source_type' => $this->source_type,
            'source_id' => $this->source_id,
            'reversal_of_id' => $this->reversal_of_id,
            'reversed_at' => $this->reversed_at?->toIso8601String(),
            'posted_at' => $this->posted_at?->toIso8601String(),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'account_id' => $line->account_id,
                'account' => $line->relationLoaded('account') && $line->account
                    ? ['id' => $line->account->id, 'code' => $line->account->code, 'name' => $line->account->name]
                    : null,
                'label' => $line->label,
                'debit' => $line->debit,
                'credit' => $line->credit,
            ])),
        ];
    }
}
