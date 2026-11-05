<?php

namespace App\Models;

use LogicException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLine extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'invoice_id', 'account_id', 'description', 'quantity', 'unit_price',
        'tax_rate', 'net_amount', 'tax_amount',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        $guard = function (self $line): void {
            $status = Invoice::withoutGlobalScopes()->whereKey($line->invoice_id)->value('status');

            if ($status !== null && $status !== Invoice::STATUS_DRAFT) {
                throw new LogicException('Les lignes d\'une facture validée sont immuables.');
            }
        };

        static::creating($guard);
        static::updating($guard);
        static::deleting($guard);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
