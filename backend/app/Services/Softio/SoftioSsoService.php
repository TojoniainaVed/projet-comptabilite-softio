<?php

namespace App\Services\Softio;

use App\Exceptions\BusinessRuleException;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\Accounting\CompanyAccountingBootstrap;
use App\Services\Admin\SettingsService;
use App\Support\PermissionCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Connexion d'un utilisateur venant de Softio. Au premier passage, son entreprise
 * (avec plan comptable, journaux et exercice) et son compte sont créés.
 */
class SoftioSsoService
{
    public function __construct(
        private readonly SoftioClient $softio,
        private readonly CompanyAccountingBootstrap $bootstrap,
        private readonly SettingsService $settings,
    ) {}

    public function connecter(string $code): User
    {
        $infos = $this->softio->echanger($code);

        $moduleAttendu = config('softio.sso.module_id');
        if ($moduleAttendu !== null && (int) ($infos['module']['id'] ?? 0) !== $moduleAttendu) {
            throw new BusinessRuleException('Ce lien ne concerne pas le module Comptabilité.', 'softio_wrong_module');
        }

        if (! ($infos['acces']['actif'] ?? false)) {
            throw new BusinessRuleException(
                "Votre abonnement au module Comptabilité n'est pas actif. Renouvelez-le depuis Softio.",
                'softio_access_inactive',
            );
        }

        $user = DB::transaction(fn (): User => $this->synchroniser($infos));

        if (! $user->is_active || ($user->company && ! $user->company->isActive())) {
            throw new BusinessRuleException('Ce compte est désactivé dans la comptabilité.', 'account_disabled');
        }

        return $user->load(['role', 'company']);
    }

    /** @param array<string, mixed> $infos */
    private function synchroniser(array $infos): User
    {
        $softioUser = $infos['utilisateur'];
        $organisation = $infos['organisation'];
        $estProprietaire = (int) $softioUser['id'] === (int) $organisation['id'];

        $company = Company::query()->where('softio_organisation_id', $organisation['id'])->first()
            ?? $this->creerEntreprise($organisation);

        $nom = trim(($softioUser['prenom'] ?? '') . ' ' . ($softioUser['nom'] ?? '')) ?: $softioUser['email'];
        $user = User::query()->where('softio_user_id', $softioUser['id'])->first();

        if ($user) {
            // Le nom et l'e-mail suivent Softio ; le rôle reste celui choisi dans la comptabilité.
            $email = mb_strtolower($softioUser['email']);
            $emailLibre = ! User::query()->where('email', $email)->whereKeyNot($user->id)->exists();
            $user->update(['name' => $nom] + ($emailLibre ? ['email' => $email] : []));

            return $user;
        }

        // Un compte local avec la même adresse n'est jamais repris automatiquement :
        // ce serait une porte d'entrée vers un compte qui n'appartient peut-être pas à cette personne.
        if (User::query()->where('email', mb_strtolower($softioUser['email']))->exists()) {
            throw new BusinessRuleException(
                'Un compte comptable existe déjà avec cette adresse e-mail. Contactez l\'administrateur.',
                'softio_email_taken',
            );
        }

        $role = $estProprietaire ? PermissionCatalog::COMPANY_ADMIN : config('softio.sso.role_utilisateur');

        return User::create([
            'softio_user_id' => $softioUser['id'],
            'company_id' => $company->id,
            'role_id' => Role::query()->where('slug', $role)->value('id'),
            'name' => $nom,
            'email' => $softioUser['email'],
            // Connexion uniquement via Softio : mot de passe aléatoire, jamais communiqué
            'password' => Str::random(48),
            'is_active' => true,
            'must_verify_email' => false,
            'email_verified_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $organisation */
    private function creerEntreprise(array $organisation): Company
    {
        $defaults = $this->settings->all();

        $company = Company::create([
            'softio_organisation_id' => $organisation['id'],
            'name' => $organisation['nom'] ?: $organisation['email'],
            'email' => $organisation['email'] ?? null,
            'currency' => $defaults['default_currency'],
            'locale' => $defaults['default_locale'],
            'status' => Company::STATUS_ACTIVE,
        ]);
        $this->bootstrap->run($company);

        return $company;
    }
}
