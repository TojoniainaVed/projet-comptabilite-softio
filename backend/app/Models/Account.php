<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use BelongsToCompany, HasFactory;

    public const TYPES = [
        'asset',
        'liability',
        'equity',
        'income',
        'expense',
    ];

    public const CATEGORIES = [
        'receivable',
        'payable',
        'bank',
        'cash',
        'vat_collected',
        'vat_deductible',
    ];

    protected $fillable = [
        'company_id',
        'parent_id',
        'code',
        'name',
        'type',
        'category',
        'is_group',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_group' => 'boolean',
        'parent_id' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Account::class, 'parent_id')
            ->orderBy('code');
    }
}
