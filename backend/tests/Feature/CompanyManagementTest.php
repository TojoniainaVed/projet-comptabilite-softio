<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\FiscalYear;
use App\Models\Journal;

class CompanyManagementTest extends FeatureTestCase
{
    private function payload(array $override = []): array
    {
        return array_replace(['name' => 'Nouvelle Société', 'currency' => 'MGA', 'locale' => 'fr'], $override);
    }

    public function test_creating_a_company_provisions_accounts_journals_and_fiscal_year(): void
    {
        $this->signIn('super-admin');

        $id = $this->postJson('/api/v1/admin/companies', $this->payload())->assertCreated()->json('data.id');

        $this->assertGreaterThan(10, Account::withoutGlobalScopes()->where('company_id', $id)->count());
        $this->assertSame(5, Journal::withoutGlobalScopes()->where('company_id', $id)->count());
        $this->assertSame(1, FiscalYear::withoutGlobalScopes()->where('company_id', $id)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'company.created', 'company_id' => $id]);
    }

    public function test_company_validation(): void
    {
        $this->signIn('super-admin');

        $this->postJson('/api/v1/admin/companies', $this->payload(['name' => '', 'currency' => 'euro']))
            ->assertStatus(422)->assertJsonValidationErrors(['name', 'currency']);
    }

    public function test_company_admin_sees_and_edits_only_their_company_but_cannot_change_status(): void
    {
        $admin = $this->signIn('company-admin');
        $other = $this->makeCompany();

        $this->getJson('/api/v1/admin/companies')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $admin->company_id);
        $this->getJson("/api/v1/admin/companies/{$other->id}")->assertForbidden();
        $this->putJson("/api/v1/admin/companies/{$other->id}", $this->payload())->assertForbidden();

        $this->putJson("/api/v1/admin/companies/{$admin->company_id}", $this->payload(['name' => 'Renommée']))->assertOk()->assertJsonPath('data.name', 'Renommée');
        $this->putJson("/api/v1/admin/companies/{$admin->company_id}", $this->payload(['status' => 'suspended']))->assertForbidden();
    }

    public function test_suspending_a_company_cuts_off_its_users_immediately(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser('accountant', $company, ['email' => 'compta@softio.test']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => 'Mot-de-passe-1234'])->json('token');

        $this->signIn('super-admin');
        $this->putJson("/api/v1/admin/companies/{$company->id}", $this->payload(['status' => 'suspended']))->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'company.suspended']);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/accounts')->assertForbidden()->assertJsonPath('code', 'account_disabled');
        $this->assertNotNull($user);
    }
}
