<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use Illuminate\Support\Facades\RateLimiter;

class AuthTest extends FeatureTestCase
{
    private const PASSWORD = 'Mot-de-passe-1234';

    public function test_login_returns_a_token_the_user_and_permissions(): void
    {
        $user = $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => self::PASSWORD]);

        $response->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'email', 'role' => ['slug'], 'company' => ['id'], 'permissions']]);
        $this->assertContains('entries.create', $response->json('user.permissions'));
        $this->assertNotContains('users.create', $response->json('user.permissions'));
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'user_id' => $user->id]);
    }

    public function test_wrong_password_is_rejected_and_audited_without_the_password(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);

        $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => 'mauvais-mot-de-passe'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $log = AuditLog::query()->where('action', 'auth.login_failed')->firstOrFail();
        $this->assertStringNotContainsString('mauvais-mot-de-passe', json_encode($log->metadata));
    }

    public function test_inactive_user_and_suspended_company_cannot_log_in(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'off@softio.test', 'is_active' => false]);
        $this->makeUser('accountant', $this->makeCompany(['status' => 'suspended']), ['email' => 'susp@softio.test']);

        foreach (['off@softio.test', 'susp@softio.test'] as $email) {
            $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => self::PASSWORD])->assertStatus(422);
        }
    }

    public function test_protected_routes_require_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/accounts')->assertUnauthorized();
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();
    }

    public function test_logout_revokes_the_token(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => self::PASSWORD])->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_deactivating_a_user_immediately_blocks_a_live_token(): void
    {
        $user = $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => self::PASSWORD])->json('token');

        $user->update(['is_active' => false]);
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertForbidden()->assertJsonPath('code', 'account_disabled');
    }

    public function test_login_is_rate_limited(): void
    {
        RateLimiter::clear('login');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@softio.test', 'password' => 'x'])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@softio.test', 'password' => 'x'])->assertStatus(429);
    }

    public function test_public_platform_endpoint_exposes_only_branding(): void
    {
        $this->getJson('/api/v1/platform')->assertOk()
            ->assertJsonStructure(['data' => ['platform_name', 'brand_color', 'default_locale']])
            ->assertJsonMissingPath('data.default_currency')
            ->assertJsonMissingPath('data.features');
    }
}
