<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Partner;
use App\Models\Role;
use App\Models\User;
use App\Services\Accounting\CompanyAccountingBootstrap;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * DONNÉES DE DÉMONSTRATION — à ne jamais utiliser en production.
 * L'entreprise créée porte explicitement la mention « démonstration » dans son nom.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::firstOrCreate(
            ['name' => 'Entreprise Démo (données de démonstration)'],
            ['currency' => 'MGA', 'locale' => 'fr', 'status' => Company::STATUS_ACTIVE],
        );
        app(CompanyAccountingBootstrap::class)->run($company);

        $password = env('SEED_ADMIN_PASSWORD') ?: Str::password(16);
        $users = [
            'company-admin' => 'demo.admin@softio.test',
            'accountant' => 'demo.comptable@softio.test',
            'finance-manager' => 'demo.finance@softio.test',
            'billing-manager' => 'demo.facturation@softio.test',
            'auditor' => 'demo.audit@softio.test',
        ];

        foreach ($users as $roleSlug => $email) {
            User::firstOrCreate(['email' => $email], [
                'name' => 'Démo — '.Role::query()->where('slug', $roleSlug)->value('name'),
                'password' => $password,
                'role_id' => Role::query()->where('slug', $roleSlug)->value('id'),
                'company_id' => $company->id,
                'is_active' => true,
            ]);
        }

        foreach ([['customer', 'Client Démo SARL'], ['customer', 'Boutique Exemple'], ['supplier', 'Fournisseur Démo SA']] as [$type, $name]) {
            Partner::withoutGlobalScopes()->firstOrCreate(
                ['company_id' => $company->id, 'type' => $type, 'name' => $name],
                ['is_active' => true],
            );
        }

        $this->command?->warn('Données de démonstration créées. Comptes : '.implode(', ', $users));
        if (! env('SEED_ADMIN_PASSWORD')) {
            $this->command?->warn("Mot de passe des comptes de démonstration (affiché une seule fois) : $password");
        }
    }
}
