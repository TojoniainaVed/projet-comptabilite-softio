<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class JournalEntryLine extends Model
{
    public $timestamps = false;

    protected $fillable = ['journal_entry_id', 'account_id', 'label', 'debit', 'credit'];

    protected $casts = ['debit' => 'decimal:2', 'credit' => 'decimal:2'];

    protected static function booted(): void
    {
        // Les lignes d'une écriture non brouillon ne se modifient ni ne se suppriment.
        $guard = function (self $line): void {
            $status = JournalEntry::withoutGlobalScopes()
                ->whereKey($line->journal_entry_id)
                ->value('status');

            if ($status !== null && $status !== JournalEntry::STATUS_DRAFT) {
                throw new LogicException('Les lignes d\'une écriture validée sont immuables.');
            }
        };

        static::creating($guard);
        static::updating($guard);
        static::deleting($guard);
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
