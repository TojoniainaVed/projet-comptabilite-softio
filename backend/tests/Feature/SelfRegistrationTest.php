<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\Account\AccountMailer;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use InvalidArgumentException;
use Tests\Support\RecordingMailer;

class SelfRegistrationTest extends FeatureTestCase
{
    private const PASSWORD = 'Mot-de-passe-1234';

    private RecordingMailer $mailer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mailer = new RecordingMailer;
        $this->app->instance(AccountMailer::class, $this->mailer);
        config(['softio.registration.enabled' => true, 'softio.registration.require_email_verification' => true]);
    }

    /** @return array<string, mixed> */
    private function payload(array $override = []): array
    {
        return $override + [
            'company_name' => 'Rakoto & Fils',
            'name' => 'Rakoto Jean',
            'email' => 'Jean@Rakoto.test',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
            'accept_terms' => true,
        ];
    }

    public function test_registration_creates_company_with_accounting_and_a_company_admin(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())
            ->assertCreated()->assertJson(['verification_required' => true]);

        $user = User::query()->where('email', 'jean@rakoto.test')->firstOrFail();
        $this->assertSame('company-admin', $user->role->slug);
        $this->assertTrue($user->must_verify_email);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));

        $company = $user->company;
        $this->assertSame('Rakoto & Fils', $company->name);
        $this->assertSame(Company::STATUS_ACTIVE, $company->status);
        $this->assertNotSame(0, $this->accountId($company, '512'));
        $this->assertNotSame(0, $this->journalId($company, 'VEN'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.registered', 'user_id' => $user->id]);
        $this->assertCount(1, $this->mailer->verificationUrls);
    }

    public function test_registration_validates_input(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'pris@softio.test']);

        $this->postJson('/api/v1/auth/register', $this->payload(['email' => 'PRIS@softio.test']))->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/auth/register', $this->payload(['password' => 'court', 'password_confirmation' => 'court']))->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/auth/register', $this->payload(['password_confirmation' => 'Autre-mot-de-passe-12']))->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/auth/register', $this->payload(['accept_terms' => false]))->assertStatus(422)->assertJsonValidationErrors('accept_terms');
        $this->postJson('/api/v1/auth/register', $this->payload(['company_name' => '']))->assertStatus(422)->assertJsonValidationErrors('company_name');
        $this->assertSame(1, Company::query()->count());
    }

    public function test_registration_cannot_choose_a_role_or_an_existing_company(): void
    {
        $other = $this->makeCompany();
        $this->postJson('/api/v1/auth/register', $this->payload(['role_id' => 1, 'company_id' => $other->id, 'is_active' => false]))->assertCreated();

        $user = User::query()->where('email', 'jean@rakoto.test')->firstOrFail();
        $this->assertNotSame($other->id, $user->company_id);
        $this->assertSame('company-admin', $user->role->slug);
        $this->assertTrue($user->is_active);
    }

    public function test_registration_can_be_closed(): void
    {
        config(['softio.registration.enabled' => false]);

        $this->postJson('/api/v1/auth/register', $this->payload())->assertStatus(422)->assertJson(['code' => 'registration_disabled']);
        $this->assertDatabaseMissing('users', ['email' => 'jean@rakoto.test']);
    }

    public function test_login_is_blocked_until_the_email_is_confirmed_then_works(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $credentials = ['email' => 'jean@rakoto.test', 'password' => self::PASSWORD];

        $this->postJson('/api/v1/auth/login', $credentials)->assertStatus(422)->assertJson(['code' => 'email_not_verified']);
        // Un mauvais mot de passe ne révèle pas que le compte existe.
        $this->postJson('/api/v1/auth/login', ['password' => 'mauvais-mot-de-passe-1'] + $credentials)->assertStatus(422)->assertJsonMissingPath('code');

        $this->get($this->mailer->verificationUrls[0])->assertRedirect(config('softio.frontend_url').'/login?verified=1');

        $user = User::query()->where('email', 'jean@rakoto.test')->firstOrFail();
        $this->assertFalse($user->must_verify_email);
        $this->assertNotNull($user->email_verified_at);
        $this->postJson('/api/v1/auth/login', $credentials)->assertOk()->assertJsonStructure(['token']);
    }

    public function test_tampered_or_foreign_verification_links_are_rejected(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $url = $this->mailer->verificationUrls[0];

        $this->get(preg_replace('/signature=[a-f0-9]+/', 'signature=deadbeef', $url))->assertRedirect(config('softio.frontend_url').'/login?verified=expired');
        // Mauvais hash (signature recalculée : seul un hash correspondant à l'e-mail est accepté).
        $other = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => User::query()->value('id'), 'hash' => sha1('autre@x.test')]);
        $this->get($other)->assertRedirect(config('softio.frontend_url').'/login?verified=invalid');

        $this->assertTrue(User::query()->where('email', 'jean@rakoto.test')->firstOrFail()->must_verify_email);
    }

    public function test_email_with_line_breaks_is_rejected_to_prevent_header_injection(): void
    {
        // Le premier cas est celui de l'alerte CVE-2026-48019 : accepté par la règle « email » de Laravel 10.
        foreach (["\"jean\r\nBcc: victime@x.test\"@rakoto.test", "jean@rakoto.test\r\nBcc: victime@x.test", "jean\r@rakoto.test"] as $email) {
            $this->postJson('/api/v1/auth/register', $this->payload(['email' => $email]))
                ->assertUnprocessable()->assertJsonValidationErrors('email');
        }

        $this->postJson('/api/v1/auth/password/forgot', ['email' => "\"jean\r\nBcc: victime@x.test\"@rakoto.test"])
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertSame(0, User::query()->count());
        $this->assertCount(0, $this->mailer->verificationUrls);
    }

    public function test_mailer_refuses_an_address_with_line_breaks_even_if_stored(): void
    {
        Mail::fake();
        $user = new User(['name' => 'Jean', 'email' => "\"jean\r\nBcc: victime@x.test\"@rakoto.test"]);

        $this->expectException(InvalidArgumentException::class);
        (new AccountMailer)->sendPasswordReset($user, 'https://exemple.test/reset');
    }

    public function test_expired_verification_link_is_rejected(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();

        $this->travel(49)->hours();
        $this->get($this->mailer->verificationUrls[0])->assertRedirect(config('softio.frontend_url').'/login?verified=expired');
        $this->assertTrue(User::query()->where('email', 'jean@rakoto.test')->firstOrFail()->must_verify_email);
    }

    public function test_registration_without_verification_allows_immediate_login(): void
    {
        config(['softio.registration.require_email_verification' => false]);

        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated()->assertJson(['verification_required' => false]);

        $this->assertSame([], $this->mailer->verificationUrls);
        $this->postJson('/api/v1/auth/login', ['email' => 'jean@rakoto.test', 'password' => self::PASSWORD])->assertOk();
    }

    public function test_existing_users_are_not_locked_out(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'ancien@softio.test']);

        $this->postJson('/api/v1/auth/login', ['email' => 'ancien@softio.test', 'password' => self::PASSWORD])->assertOk();
    }

    public function test_resend_is_generic_and_only_sends_for_pending_accounts(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'actif@softio.test']);

        $this->postJson('/api/v1/auth/email/resend', ['email' => 'jean@rakoto.test'])->assertStatus(202);
        $this->postJson('/api/v1/auth/email/resend', ['email' => 'actif@softio.test'])->assertStatus(202);
        $inconnu = $this->postJson('/api/v1/auth/email/resend', ['email' => 'inconnu@softio.test']);

        $inconnu->assertStatus(202);
        $this->assertCount(2, $this->mailer->verificationUrls); // inscription + renvoi pour le compte en attente uniquement
    }

    public function test_forgot_password_is_generic_and_reset_changes_password_and_revokes_sessions(): void
    {
        $user = $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);
        $user->createToken('web');

        $unknown = $this->postJson('/api/v1/auth/password/forgot', ['email' => 'inconnu@softio.test']);
        $known = $this->postJson('/api/v1/auth/password/forgot', ['email' => 'Compta@softio.test']);
        $this->assertSame($unknown->json('message'), $known->json('message'));
        $this->assertCount(1, $this->mailer->resetUrls);

        parse_str((string) parse_url($this->mailer->resetUrls[0], PHP_URL_QUERY), $query);
        $this->assertSame('compta@softio.test', $query['email']);
        $new = 'Nouveau-mot-de-passe-77';

        $this->postJson('/api/v1/auth/password/reset', ['token' => $query['token'], 'email' => 'compta@softio.test', 'password' => $new, 'password_confirmation' => $new])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
        $this->postJson('/api/v1/auth/login', ['email' => 'compta@softio.test', 'password' => $new])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.password_reset', 'user_id' => $user->id]);

        // Le lien ne sert qu'une fois.
        $this->postJson('/api/v1/auth/password/reset', ['token' => $query['token'], 'email' => 'compta@softio.test', 'password' => 'Encore-un-autre-88', 'password_confirmation' => 'Encore-un-autre-88'])
            ->assertStatus(422)->assertJson(['code' => 'invalid_reset_token']);
    }

    public function test_reset_rejects_bad_token_and_weak_password(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'compta@softio.test']);
        $this->postJson('/api/v1/auth/password/forgot', ['email' => 'compta@softio.test']);
        parse_str((string) parse_url($this->mailer->resetUrls[0], PHP_URL_QUERY), $query);

        $this->postJson('/api/v1/auth/password/reset', ['token' => 'faux', 'email' => 'compta@softio.test', 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])
            ->assertStatus(422)->assertJson(['code' => 'invalid_reset_token']);
        $this->postJson('/api/v1/auth/password/reset', ['token' => $query['token'], 'email' => 'compta@softio.test', 'password' => 'faible', 'password_confirmation' => 'faible'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_reset_confirms_a_pending_email(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $this->postJson('/api/v1/auth/password/forgot', ['email' => 'jean@rakoto.test']);
        parse_str((string) parse_url($this->mailer->resetUrls[0], PHP_URL_QUERY), $query);
        $new = 'Nouveau-mot-de-passe-77';

        $this->postJson('/api/v1/auth/password/reset', ['token' => $query['token'], 'email' => 'jean@rakoto.test', 'password' => $new, 'password_confirmation' => $new])->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => 'jean@rakoto.test', 'password' => $new])->assertOk();
    }

    public function test_platform_endpoint_exposes_registration_settings(): void
    {
        $this->getJson('/api/v1/platform')->assertOk()
            ->assertJsonPath('data.registration_enabled', true)
            ->assertJsonPath('data.password_min_length', 12);
    }

    public function test_emails_are_stored_in_lowercase_when_admins_create_users(): void
    {
        $company = $this->makeCompany();
        $this->signIn('company-admin', $company);
        $roleId = Role::query()->where('slug', 'accountant')->value('id');

        $this->postJson('/api/v1/admin/users', ['name' => 'Nouvelle', 'email' => 'Nouvelle@Softio.TEST', 'password' => self::PASSWORD, 'role_id' => $roleId])->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'nouvelle@softio.test']);
    }
}
