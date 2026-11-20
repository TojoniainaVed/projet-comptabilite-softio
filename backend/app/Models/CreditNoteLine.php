<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditNoteLine extends Model
{
    protected $fillable = [
        'credit_note_id',
        'invoice_line_id',
        'account_id',
        'description',
        'quantity',
        'unit_price',
        'tax_rate',
        'net_amount',
        'tax_amount',
    ];

    protected $attributes = [
        'tax_rate' => '0.00',
        'net_amount' => '0.00',
        'tax_amount' => '0.00',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
    ];

    public function creditNote(): BelongsTo
    {
        return $this->belongsTo(CreditNote::class);
    }

    public function invoiceLine(): BelongsTo
    {
        return $this->belongsTo(InvoiceLine::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
