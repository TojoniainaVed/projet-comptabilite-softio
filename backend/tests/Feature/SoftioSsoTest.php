<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SoftioSsoTest extends FeatureTestCase
{
    private const API = 'http://softio.test/api';

    /** Réponses simulées de Softio : [statut, corps] par chemin */
    private array $softio = [];

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'softio.sso.api_url' => self::API,
            'softio.sso.secret' => 'secret-partage',
            'softio.sso.module_id' => 7,
        ]);
        Cache::flush();

        Http::fake(function (Request $request) {
            $chemin = substr($request->url(), strlen(self::API));
            [$statut, $corps] = $this->softio[$chemin] ?? [500, []];

            return Http::response($corps, $statut);
        });
    }

    public function test_le_proprietaire_arrive_de_softio_et_son_entreprise_est_creee(): void
    {
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10));

        $response = $this->postJson('/api/v1/auth/sso', ['code' => 'code-valide'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role' => ['slug'], 'company' => ['id']]])
            ->assertJsonPath('user.role.slug', 'company-admin');

        $company = Company::query()->where('softio_organisation_id', 10)->firstOrFail();
        $this->assertSame('Rakoto Jean', $company->name);
        $this->assertTrue(Account::withoutGlobalScopes()->where('company_id', $company->id)->exists(), 'Plan comptable créé');
        $this->assertSame($company->id, $response->json('user.company.id'));

        Http::assertSent(fn (Request $request) => $request->url() === self::API . '/sso/echanger'
            && $request->header('X-Sso-Secret')[0] === 'secret-partage'
            && $request['code'] === 'code-valide');
    }

    public function test_l_employe_rejoint_l_entreprise_de_son_client_avec_le_role_comptable(): void
    {
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10));
        $this->postJson('/api/v1/auth/sso', ['code' => 'a'])->assertOk();

        $this->simulerSoftio($this->infos(utilisateurId: 11, organisationId: 10, email: 'employe@example.test'));
        $this->postJson('/api/v1/auth/sso', ['code' => 'b'])
            ->assertOk()
            ->assertJsonPath('user.role.slug', 'accountant');

        $this->assertSame(1, Company::query()->where('softio_organisation_id', 10)->count());
        $this->assertSame(
            User::query()->where('softio_user_id', 10)->value('company_id'),
            User::query()->where('softio_user_id', 11)->value('company_id'),
        );
    }

    public function test_une_deuxieme_connexion_reutilise_le_meme_compte(): void
    {
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10));
        $this->postJson('/api/v1/auth/sso', ['code' => 'a'])->assertOk();
        $this->postJson('/api/v1/auth/sso', ['code' => 'b'])->assertOk();

        $this->assertSame(1, User::query()->where('softio_user_id', 10)->count());
        $this->assertSame(1, Company::query()->count());
    }

    public function test_code_invalide_ou_expire(): void
    {
        $this->softio['/sso/echanger'] = [422, ['message' => 'Code invalide ou expiré.']];

        $this->postJson('/api/v1/auth/sso', ['code' => 'perime'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'softio_code_invalid');

        $this->assertSame(0, User::query()->whereNotNull('softio_user_id')->count());
    }

    public function test_mauvaise_cle_ou_panne_de_softio_donnent_un_message_clair(): void
    {
        $this->softio['/sso/echanger'] = [401, ['message' => 'Accès refusé.']];
        $this->postJson('/api/v1/auth/sso', ['code' => 'x'])->assertJsonPath('code', 'softio_bad_secret');

        $this->softio['/sso/echanger'] = [500, ['message' => 'Erreur']];
        $this->postJson('/api/v1/auth/sso', ['code' => 'x'])->assertJsonPath('code', 'softio_error');
    }

    public function test_abonnement_inactif(): void
    {
        $this->softio['/sso/echanger'] = [403, ['message' => 'Pas accès']];

        $this->postJson('/api/v1/auth/sso', ['code' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'softio_access_inactive');
    }

    public function test_un_code_d_un_autre_module_est_refuse(): void
    {
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10, moduleId: 99));

        $this->postJson('/api/v1/auth/sso', ['code' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'softio_wrong_module');
    }

    public function test_un_compte_local_avec_la_meme_adresse_n_est_pas_repris(): void
    {
        $this->makeUser('accountant', $this->makeCompany(), ['email' => 'jean@example.test']);
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10, email: 'jean@example.test'));

        $this->postJson('/api/v1/auth/sso', ['code' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'softio_email_taken');
    }

    public function test_la_session_est_fermee_quand_l_abonnement_n_est_plus_actif(): void
    {
        $this->simulerSoftio($this->infos(utilisateurId: 10, organisationId: 10));
        $token = $this->postJson('/api/v1/auth/sso', ['code' => 'x'])->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();

        // Abonnement coupé dans Softio, et la vérification précédente a expiré
        Cache::flush();
        $this->softio['/sso/verifier'] = [200, $this->infos(10, 10, actif: false)];

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'softio_access_inactive');
        $this->assertSame(0, User::query()->where('softio_user_id', 10)->firstOrFail()->tokens()->count());
    }

    public function test_les_comptes_locaux_ne_sont_pas_verifies_aupres_de_softio(): void
    {
        $this->signIn('accountant');

        $this->getJson('/api/v1/auth/me')->assertOk();

        Http::assertNothingSent();
    }

    // --- Helpers ---

    private function simulerSoftio(array $infos): void
    {
        $this->softio['/sso/echanger'] = [200, $infos];
        $this->softio['/sso/verifier'] = [200, $infos];
    }

    private function infos(
        int $utilisateurId,
        int $organisationId,
        string $email = 'jean@example.test',
        int $moduleId = 7,
        bool $actif = true,
    ): array {
        return [
            'utilisateur' => ['id' => $utilisateurId, 'nom' => 'Rakoto', 'prenom' => 'Jean', 'email' => $email, 'role' => 'client_admin'],
            'organisation' => ['id' => $organisationId, 'nom' => 'Rakoto Jean', 'email' => 'jean@example.test'],
            'module' => ['id' => $moduleId, 'nom' => 'Comptabilité'],
            'acces' => ['actif' => $actif, 'date_fin' => '2026-12-11'],
        ];
    }
}
