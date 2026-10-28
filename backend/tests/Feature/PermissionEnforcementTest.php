<?php

namespace Tests\Feature;

class PermissionEnforcementTest extends FeatureTestCase
{
    public function test_auditor_can_read_but_never_write(): void
    {
        $company = $this->makeCompany();
        $this->signIn('auditor', $company);

        $this->getJson('/api/v1/accounts')->assertOk();
        $this->postJson('/api/v1/accounts', ['code' => '999', 'name' => 'Test', 'type' => 'expense'])->assertForbidden();
        $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->assertForbidden();
        $this->postJson('/api/v1/customers', ['name' => 'Client'])->assertForbidden();
        $this->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_accountant_can_record_but_not_reverse_or_export(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);

        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->assertCreated()->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();

        $this->postJson("/api/v1/journal-entries/$id/reverse")->assertForbidden();
        $this->getJson('/api/v1/journal-entries/export')->assertForbidden();
        $this->getJson('/api/v1/reports/trial-balance?format=csv')->assertForbidden();
    }

    public function test_billing_manager_cannot_touch_journal_entries_or_expenses(): void
    {
        $company = $this->makeCompany();
        $this->signIn('billing-manager', $company);

        $this->getJson('/api/v1/journal-entries')->assertForbidden();
        $this->getJson('/api/v1/expenses')->assertForbidden();
        $this->getJson('/api/v1/invoices')->assertOk();
    }

    public function test_super_admin_has_no_access_to_accounting_data(): void
    {
        $this->signIn('super-admin');

        $this->getJson('/api/v1/accounts')->assertForbidden()->assertJsonPath('code', 'company_required');
        $this->getJson('/api/v1/dashboard')->assertForbidden();
        $this->getJson('/api/v1/admin/users')->assertOk();
    }

    public function test_company_admin_cannot_use_platform_only_features(): void
    {
        $this->signIn('company-admin');

        $this->getJson('/api/v1/admin/settings')->assertForbidden();
        $this->putJson('/api/v1/admin/settings', ['platform_name' => 'Pirate'])->assertForbidden();
        $this->postJson('/api/v1/admin/companies', ['name' => 'X', 'currency' => 'EUR', 'locale' => 'fr'])->assertForbidden();
    }

    public function test_changing_role_permissions_takes_effect_immediately(): void
    {
        $company = $this->makeCompany();
        $accountant = $this->makeUser('accountant', $company);
        $role = $accountant->role;

        $this->signIn('super-admin');
        $this->putJson("/api/v1/admin/roles/{$role->id}/permissions", ['permissions' => ['accounts.view']])
            ->assertOk()->assertJsonPath('data.permissions', ['accounts.view']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'role.permissions_changed']);

        \Laravel\Sanctum\Sanctum::actingAs($accountant->fresh(), ['*']);
        $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->assertForbidden();
        $this->getJson('/api/v1/accounts')->assertOk();
    }

    public function test_super_admin_role_is_frozen_and_slugs_are_validated(): void
    {
        $superAdmin = $this->makeUser('super-admin');
        \Laravel\Sanctum\Sanctum::actingAs($superAdmin, ['*']);

        $this->putJson("/api/v1/admin/roles/{$superAdmin->role_id}/permissions", ['permissions' => []])->assertForbidden();

        $accountantRoleId = \App\Models\Role::query()->where('slug', 'accountant')->value('id');
        $this->putJson("/api/v1/admin/roles/$accountantRoleId/permissions", ['permissions' => ['inconnue.permission']])
            ->assertStatus(422)->assertJsonValidationErrors('permissions.0');
    }

    public function test_company_admin_cannot_edit_role_permissions(): void
    {
        $admin = $this->signIn('company-admin');

        $this->putJson("/api/v1/admin/roles/{$admin->role_id}/permissions", ['permissions' => []])->assertForbidden();
    }
}
