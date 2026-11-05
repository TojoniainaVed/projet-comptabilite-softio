<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use LogicException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JournalEntry extends Model
{
    use BelongsToCompany;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_POSTED = 'posted';

    public const STATUS_REVERSED = 'reversed';

    /** Seuls ces champs peuvent changer sur une écriture déjà validée (annulation par contrepassation). */
    private const MUTABLE_AFTER_POSTING = ['status', 'reversed_at', 'updated_at'];

    protected $fillable = [
        'company_id', 'journal_id', 'fiscal_year_id', 'reference', 'entry_date', 'description',
        'status', 'source_type', 'source_id', 'reversal_of_id', 'reversed_at',
        'posted_at', 'posted_by', 'created_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Une écriture validée est immuable : seule la contrepassation peut la marquer « annulée ».
        static::updating(function (self $entry): void {
            if ($entry->getOriginal('status') === self::STATUS_DRAFT) {
                return;
            }

            $forbidden = array_diff(array_keys($entry->getDirty()), self::MUTABLE_AFTER_POSTING);
            if ($forbidden !== []) {
                throw new LogicException('Une écriture validée ne peut pas être modifiée.');
            }
        });

        static::deleting(function (self $entry): void {
            if ($entry->status !== self::STATUS_DRAFT) {
                throw new LogicException('Une écriture validée ne peut pas être supprimée.');
            }
        });
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(Journal::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class)->orderBy('id');
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
