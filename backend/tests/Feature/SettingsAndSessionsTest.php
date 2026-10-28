<?php

namespace Tests\Feature;

use App\Models\Role;

class SettingsAndSessionsTest extends FeatureTestCase
{
    public function test_super_admin_updates_settings_and_the_public_endpoint_reflects_them(): void
    {
        $this->signIn('super-admin');

        $this->putJson('/api/v1/admin/settings', ['platform_name' => 'Softio Madagascar', 'brand_color' => '#112233', 'password_min_length' => 14])
            ->assertOk()->assertJsonPath('data.platform_name', 'Softio Madagascar');

        $this->getJson('/api/v1/platform')->assertJsonPath('data.platform_name', 'Softio Madagascar')->assertJsonPath('data.brand_color', '#112233');
        $this->assertDatabaseHas('audit_logs', ['action' => 'settings.updated']);

        // La nouvelle longueur minimale s'applique à la création d'utilisateurs.
        $company = $this->makeCompany();
        $this->postJson('/api/v1/admin/users', [
            'name' => 'X', 'email' => 'x@softio.test', 'password' => 'Court-1234567', // 13 caractères < 14
            'role_id' => Role::query()->where('slug', 'accountant')->value('id'), 'company_id' => $company->id,
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_settings_validation_rejects_unsafe_values(): void
    {
        $this->signIn('super-admin');

        $this->putJson('/api/v1/admin/settings', ['brand_color' => 'red', 'password_min_length' => 3])
            ->assertStatus(422)->assertJsonValidationErrors(['brand_color', 'password_min_length']);
    }

    public function test_sessions_are_listed_and_revocable_within_visibility(): void
    {
        $company = $this->makeCompany();
        $mine = $this->makeUser('accountant', $company);
        $foreign = $this->makeUser('accountant', $this->makeCompany());
        $mine->createToken('portable');
        $foreignToken = $foreign->createToken('ailleurs')->accessToken;

        $this->signIn('company-admin', $company);
        $devices = collect($this->getJson('/api/v1/admin/sessions')->assertOk()->json('data'))->pluck('device');
        $this->assertTrue($devices->contains('portable'));
        $this->assertFalse($devices->contains('ailleurs'));

        $this->deleteJson("/api/v1/admin/sessions/{$foreignToken->id}")->assertNotFound();

        $tokenId = $mine->tokens()->first()->id;
        $this->deleteJson("/api/v1/admin/sessions/$tokenId")->assertNoContent();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'session.revoked']);
    }

    public function test_admin_dashboard_reports_real_figures(): void
    {
        $company = $this->makeCompany();
        $admin = $this->signIn('company-admin', $company);
        $this->makeUser('accountant', $company);
        $this->makeUser('auditor', $company, ['is_active' => false]);

        $this->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.scope', 'company')
            ->assertJsonPath('data.users_total', 3)
            ->assertJsonPath('data.users_active', 2)
            ->assertJsonPath('data.companies_total', null)
            ->assertJsonCount(7, 'data.logins_by_day');

        $this->assertNotNull($admin);
    }

    public function test_platform_dashboard_counts_companies(): void
    {
        $this->makeCompany();
        $this->makeCompany();
        $this->signIn('super-admin');

        $this->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.scope', 'platform')->assertJsonPath('data.companies_total', 2);
    }
}
