<?php

namespace App\Services\Accounting;

use App\Models\Account;
use App\Models\Company;
use App\Models\FiscalYear;
use App\Models\Journal;

/**
 * Prépare la comptabilité d'une nouvelle entreprise : plan comptable de départ, journaux et exercice courant.
 *
 * Le plan proposé est un plan simplifié INSPIRÉ des usages courants ; il n'est pas présenté comme
 * conforme à un référentiel national. Chaque entreprise l'adapte ensuite à ses besoins.
 * Opère hors contexte d'authentification : les modèles sont donc créés avec un company_id explicite.
 */
class CompanyAccountingBootstrap
{
    /** @var list<array{0:string,1:string,2:string,3:?string}> code, nom, type, catégorie */
    private const ACCOUNTS = [
        ['101', 'Capital', 'equity', null],
        ['110', 'Report à nouveau', 'equity', null],
        ['211', 'Matériel et équipements', 'asset', null],
        ['401', 'Fournisseurs', 'liability', 'payable'],
        ['411', 'Clients', 'asset', 'receivable'],
        ['4456', 'TVA déductible', 'asset', 'vat_deductible'],
        ['4457', 'TVA collectée', 'liability', 'vat_collected'],
        ['512', 'Banque', 'asset', 'bank'],
        ['530', 'Caisse', 'asset', 'cash'],
        ['601', 'Achats de marchandises', 'expense', null],
        ['606', 'Fournitures et petit matériel', 'expense', null],
        ['613', 'Loyers', 'expense', null],
        ['626', 'Télécommunications', 'expense', null],
        ['641', 'Salaires', 'expense', null],
        ['701', 'Ventes de marchandises', 'income', null],
        ['706', 'Prestations de services', 'income', null],
    ];

    /** @var list<array{0:string,1:string,2:string}> */
    private const JOURNALS = [
        ['VEN', 'Journal des ventes', 'sales'],
        ['ACH', 'Journal des achats', 'purchases'],
        ['BNK', 'Journal de banque', 'bank'],
        ['CSH', 'Journal de caisse', 'cash'],
        ['OD', 'Opérations diverses', 'general'],
    ];

    public function run(Company $company, ?int $year = null): void
    {
        $year ??= (int) now()->format('Y');

        foreach (self::ACCOUNTS as [$code, $name, $type, $category]) {
            Account::withoutGlobalScopes()->firstOrCreate(
                ['company_id' => $company->id, 'code' => $code],
                ['name' => $name, 'type' => $type, 'category' => $category, 'is_active' => true],
            );
        }

        foreach (self::JOURNALS as [$code, $name, $type]) {
            Journal::withoutGlobalScopes()->firstOrCreate(
                ['company_id' => $company->id, 'code' => $code],
                ['name' => $name, 'type' => $type, 'is_active' => true],
            );
        }

        FiscalYear::withoutGlobalScopes()->firstOrCreate(
            ['company_id' => $company->id, 'name' => (string) $year],
            ['starts_on' => "$year-01-01", 'ends_on' => "$year-12-31", 'status' => FiscalYear::STATUS_OPEN],
        );
    }
}
