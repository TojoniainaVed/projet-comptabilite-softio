<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/** Comptes par défaut de l'entreprise (clients, fournisseurs, TVA, banque, caisse). */
class AccountingDefault extends Model
{
    use BelongsToCompany;

    /** Catégorie de compte => colonne, et type de compte attendu. */
    public const FIELDS = [
        'receivable' => ['column' => 'receivable_account_id', 'type' => 'asset'],
        'payable' => ['column' => 'payable_account_id', 'type' => 'liability'],
        'vat_collected' => ['column' => 'vat_collected_account_id', 'type' => 'liability'],
        'vat_deductible' => ['column' => 'vat_deductible_account_id', 'type' => 'asset'],
        'bank' => ['column' => 'bank_account_id', 'type' => 'asset'],
        'cash' => ['column' => 'cash_account_id', 'type' => 'asset'],
    ];

    protected $fillable = [
        'company_id',
        'receivable_account_id',
        'payable_account_id',
        'vat_collected_account_id',
        'vat_deductible_account_id',
        'bank_account_id',
        'cash_account_id',
    ];
}
