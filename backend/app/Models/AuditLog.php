<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Journal d'audit en écriture seule : toute modification ou suppression via Eloquent est refusée.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'company_id', 'user_id', 'action', 'subject_type', 'subject_id',
        'metadata', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException("Le journal d'audit est immuable."));
        static::deleting(fn () => throw new LogicException("Le journal d'audit est immuable."));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
