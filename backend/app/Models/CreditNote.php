<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CreditNote extends Model
{
    use BelongsToCompany;

    public const TYPE_CUSTOMER = 'customer';

    public const TYPE_SUPPLIER = 'supplier';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_POSTED = 'posted';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'company_id',
        'invoice_id',
        'partner_id',
        'journal_entry_id',
        'type',
        'number',
        'supplier_reference',
        'credit_note_date',
        'reason',
        'notes',
        'status',
        'currency',
        'subtotal',
        'tax_total',
        'total',
        'posted_at',
        'created_by',
    ];

    protected $attributes = [
        'status' => self::STATUS_DRAFT,
        'subtotal' => '0.00',
        'tax_total' => '0.00',
        'total' => '0.00',
    ];

    protected $casts = [
        'credit_note_date' => 'date',
        'posted_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'tax_total' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(CreditNoteLine::class)->orderBy('id');
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isPosted(): bool
    {
        return $this->status === self::STATUS_POSTED;
    }
}
