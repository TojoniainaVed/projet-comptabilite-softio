<?php

namespace Tests\Concerns;

use App\Models\Account;
use App\Models\Company;
use App\Models\Journal;
use App\Models\Partner;
use App\Models\Role;
use App\Models\User;
use App\Services\Accounting\CompanyAccountingBootstrap;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

trait InteractsWithTenants
{
    protected function seedRoles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /** Entreprise avec plan comptable, journaux et exercice de l'année courante. */
    protected function makeCompany(array $attributes = []): Company
    {
        $company = Company::factory()->create($attributes);
        app(CompanyAccountingBootstrap::class)->run($company);

        return $company;
    }

    protected function makeUser(string $roleSlug, ?Company $company = null, array $attributes = []): User
    {
        return User::factory()->create($attributes + [
            'role_id' => Role::query()->where('slug', $roleSlug)->value('id'),
            'company_id' => $company?->id,
        ]);
    }

    /** Authentifie un utilisateur du rôle donné (entreprise créée à la volée si besoin). */
    protected function signIn(string $roleSlug = 'accountant', ?Company $company = null): User
    {
        $platform = $roleSlug === 'super-admin';
        $user = $this->makeUser($roleSlug, $platform ? null : ($company ?? $this->makeCompany()));
        Sanctum::actingAs($user, ['*']);

        return $user;
    }

    protected function accountId(Company $company, string $code): int
    {
        return (int) Account::withoutGlobalScopes()->where('company_id', $company->id)->where('code', $code)->value('id');
    }

    protected function journalId(Company $company, string $code): int
    {
        return (int) Journal::withoutGlobalScopes()->where('company_id', $company->id)->where('code', $code)->value('id');
    }

    protected function makePartner(Company $company, string $type = 'customer'): Partner
    {
        return Partner::withoutGlobalScopes()->create([
            'company_id' => $company->id, 'type' => $type, 'name' => ucfirst($type).' '.fake()->unique()->lastName(), 'is_active' => true,
        ]);
    }

    /** @return array<string, mixed> écriture équilibrée de $amount entre banque et ventes */
    protected function entryPayload(Company $company, string $amount = '100.00', string $journal = 'OD'): array
    {
        return [
            'journal_id' => $this->journalId($company, $journal),
            'entry_date' => now()->toDateString(),
            'description' => 'Écriture de test',
            'lines' => [
                ['account_id' => $this->accountId($company, '512'), 'debit' => $amount, 'credit' => 0],
                ['account_id' => $this->accountId($company, '706'), 'debit' => 0, 'credit' => $amount],
            ],
        ];
    }
}
