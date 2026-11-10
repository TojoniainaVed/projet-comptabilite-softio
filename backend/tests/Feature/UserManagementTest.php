<?php

namespace Tests\Feature;

use App\Exceptions\BusinessRuleException;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\Admin\UserAdminGuard;

class UserManagementTest extends FeatureTestCase
{
    private function payload(array $override = []): array
    {
        return array_replace([
            'name' => 'Nouvel Utilisateur',
            'email' => 'nouveau@softio.test',
            'password' => 'Mot-de-passe-1234',
            'role_id' => Role::query()->where('slug', 'accountant')->value('id'),
        ], $override);
    }

    public function test_company_admin_creates_users_only_in_their_own_company(): void
    {
        $other = $this->makeCompany();
        $admin = $this->signIn('company-admin');

        $this->postJson('/api/v1/admin/users', $this->payload(['company_id' => $other->id]))
            ->assertCreated()->assertJsonPath('data.company.id', $admin->company_id);

        $this->assertSame($admin->company_id, User::query()->where('email', 'nouveau@softio.test')->value('company_id'));
    }

    public function test_company_admin_cannot_grant_a_platform_role(): void
    {
        $this->signIn('company-admin');

        $this->postJson('/api/v1/admin/users', $this->payload(['role_id' => Role::query()->where('slug', 'super-admin')->value('id')]))
            ->assertStatus(422)->assertJsonValidationErrors('role_id');
    }

    public function test_weak_password_is_rejected(): void
    {
        $this->signIn('company-admin');

        $this->postJson('/api/v1/admin/users', $this->payload(['password' => 'court']))->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_company_admin_only_sees_and_manages_their_own_users(): void
    {
        $admin = $this->signIn('company-admin');
        $colleague = $this->makeUser('accountant', $admin->company);
        $stranger = $this->makeUser('accountant', $this->makeCompany());

        $ids = collect($this->getJson('/api/v1/admin/users')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($colleague->id));
        $this->assertFalse($ids->contains($stranger->id));

        $this->getJson("/api/v1/admin/users/{$stranger->id}")->assertForbidden();
        $this->putJson("/api/v1/admin/users/{$stranger->id}", $this->payload())->assertForbidden();
        $this->patchJson("/api/v1/admin/users/{$stranger->id}/status", ['is_active' => false])->assertForbidden();
    }

    public function test_super_admin_must_attach_company_roles_to_a_company(): void
    {
        $this->signIn('super-admin');

        $this->postJson('/api/v1/admin/users', $this->payload())->assertStatus(422)->assertJsonValidationErrors('company_id');

        $company = $this->makeCompany();
        $this->postJson('/api/v1/admin/users', $this->payload(['company_id' => $company->id]))->assertCreated();
    }

    public function test_a_user_cannot_deactivate_themselves(): void
    {
        $admin = $this->signIn('company-admin');

        $this->patchJson("/api/v1/admin/users/{$admin->id}/status", ['is_active' => false])->assertForbidden();
    }

    public function test_last_company_admin_cannot_be_deactivated_until_another_exists(): void
    {
        $company = $this->makeCompany();
        $soleAdmin = $this->makeUser('company-admin', $company);
        $this->signIn('super-admin');

        $this->patchJson("/api/v1/admin/users/{$soleAdmin->id}/status", ['is_active' => false])
            ->assertStatus(422)->assertJsonPath('code', 'last_admin');

        $this->makeUser('company-admin', $company);
        $soleAdmin->createToken('web');

        $this->patchJson("/api/v1/admin/users/{$soleAdmin->id}/status", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $soleAdmin->id]);
    }

    public function test_demoting_the_last_company_admin_is_refused(): void
    {
        $company = $this->makeCompany();
        $soleAdmin = $this->makeUser('company-admin', $company);
        $this->signIn('super-admin');

        $this->putJson("/api/v1/admin/users/{$soleAdmin->id}", $this->payload([
            'email' => $soleAdmin->email, 'company_id' => $company->id,
        ]))->assertStatus(422)->assertJsonPath('code', 'last_admin');
    }

    public function test_guard_protects_the_last_super_admin(): void
    {
        $only = $this->makeUser('super-admin');

        $this->expectException(BusinessRuleException::class);
        app(UserAdminGuard::class)->assertNotLastAdmin($only, ['is_active' => false]);
    }

    public function test_user_changes_are_audited_without_sensitive_values(): void
    {
        $admin = $this->signIn('company-admin');
        $this->postJson('/api/v1/admin/users', $this->payload())->assertCreated();
        $id = User::query()->where('email', 'nouveau@softio.test')->value('id');

        $this->putJson("/api/v1/admin/users/$id", $this->payload(['name' => 'Renommé', 'password' => 'Autre-mot-de-passe-5678']))->assertOk();

        $logs = AuditLog::query()->whereIn('action', ['user.created', 'user.updated'])->get();
        $this->assertCount(2, $logs);
        $this->assertTrue($logs->every(fn ($log) => $log->user_id === $admin->id && $log->company_id === $admin->company_id));
        $this->assertStringNotContainsString('Mot-de-passe', json_encode($logs->pluck('metadata')));
        $this->assertStringNotContainsString('Autre-mot-de-passe', json_encode($logs->pluck('metadata')));
    }

    public function test_search_and_filters(): void
    {
        $admin = $this->signIn('company-admin');
        $this->makeUser('accountant', $admin->company, ['name' => 'Rakoto Jean']);
        $this->makeUser('auditor', $admin->company, ['name' => 'Rabe Paul', 'is_active' => false]);

        $this->getJson('/api/v1/admin/users?search=Rakoto')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/users?is_active=0')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/users?per_page=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.per_page', 1);
    }
}
