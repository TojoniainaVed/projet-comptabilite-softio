<?php

namespace App\Services\Account;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\Accounting\CompanyAccountingBootstrap;
use App\Services\Admin\SettingsService;
use App\Services\Audit\AuditLogger;
use App\Support\PermissionCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Inscription libre-service : une entreprise (avec plan comptable, journaux, exercice) et son premier
 * administrateur sont créés ensemble, dans une seule transaction.
 */
class RegistrationService
{
    public function __construct(
        private readonly CompanyAccountingBootstrap $bootstrap,
        private readonly SettingsService $settings,
        private readonly AccountMailer $mailer,
        private readonly AuditLogger $audit,
    ) {}

    public function verificationRequired(): bool
    {
        return (bool) config('softio.registration.require_email_verification');
    }

    /** @param array{company_name: string, name: string, email: string, password: string} $data */
    public function register(array $data): User
    {
        $defaults = $this->settings->all();

        $user = DB::transaction(function () use ($data, $defaults): User {
            $company = Company::create([
                'name' => $data['company_name'],
                'email' => $data['email'],
                'currency' => $defaults['default_currency'],
                'locale' => $defaults['default_locale'],
                'status' => Company::STATUS_ACTIVE,
            ]);
            $this->bootstrap->run($company);

            return User::create([
                'company_id' => $company->id,
                'role_id' => Role::query()->where('slug', PermissionCatalog::COMPANY_ADMIN)->value('id'),
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'is_active' => true,
                'must_verify_email' => $this->verificationRequired(),
                'email_verified_at' => null,
            ]);
        });

        $this->audit->log('auth.registered', $user->company, ['company' => $user->company->name, 'email' => $user->email], $user);

        if ($this->verificationRequired()) {
            $this->sendVerification($user);
        }

        return $user;
    }

    /** Envoie (ou renvoie) le lien de confirmation. Une panne d'envoi n'annule jamais l'inscription. */
    public function sendVerification(User $user): bool
    {
        try {
            $this->mailer->sendVerification($user, $this->verificationUrl($user));

            return true;
        } catch (Throwable $e) {
            Log::error('Envoi du lien de confirmation impossible.', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }
    }

    public function verificationUrl(User $user): string
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(48),
            ['id' => $user->id, 'hash' => sha1($user->email)],
        );
    }
}
