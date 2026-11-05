<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use BelongsToCompany;

    public const METHODS = ['bank_transfer', 'cash', 'check', 'card'];

    protected $fillable = [
        'company_id', 'invoice_id', 'journal_entry_id', 'treasury_account_id', 'amount',
        'paid_on', 'method', 'reference', 'idempotency_key', 'created_by',
    ];

    protected $casts = ['amount' => 'decimal:2', 'paid_on' => 'date'];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function treasuryAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'treasury_account_id');
    }
}
