<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Expense */
class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'expense_date' => $this->expense_date->toDateString(),
            'description' => $this->description,
            'amount' => $this->amount,
            'status' => $this->status,
            'reference' => $this->reference,
            'account_id' => $this->account_id,
            'account' => $this->whenLoaded('account', fn () => ['id' => $this->account->id, 'code' => $this->account->code, 'name' => $this->account->name]),
            'paid_from_account_id' => $this->paid_from_account_id,
            'paid_from_account' => $this->whenLoaded('paidFromAccount', fn () => ['id' => $this->paidFromAccount->id, 'code' => $this->paidFromAccount->code, 'name' => $this->paidFromAccount->name]),
            'partner_id' => $this->partner_id,
            'partner' => $this->whenLoaded('partner', fn () => $this->partner ? ['id' => $this->partner->id, 'name' => $this->partner->name] : null),
            'journal_entry_id' => $this->journal_entry_id,
        ];
    }
}
