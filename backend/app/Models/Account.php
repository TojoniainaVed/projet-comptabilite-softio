<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    use BelongsToCompany, HasFactory;

    public const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

    /** Catégories fonctionnelles utilisées par les services pour générer les écritures. */
    public const CATEGORIES = ['receivable', 'payable', 'bank', 'cash', 'vat_collected', 'vat_deductible'];

    protected $fillable = ['company_id', 'code', 'name', 'type', 'category', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
