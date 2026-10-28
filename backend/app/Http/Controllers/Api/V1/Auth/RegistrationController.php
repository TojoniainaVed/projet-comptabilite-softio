<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Services\Account\RegistrationService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class RegistrationController extends Controller
{
    public function __construct(
        private readonly RegistrationService $registration,
        private readonly AuditLogger $audit,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        if (! config('softio.registration.enabled')) {
            throw new BusinessRuleException("Les inscriptions sont fermées. Contactez l'administrateur de la plateforme.", 'registration_disabled');
        }

        $this->registration->register($request->safe()->only(['company_name', 'name', 'email', 'password']));
        $verify = $this->registration->verificationRequired();

        return response()->json([
            'message' => $verify
                ? 'Compte créé. Un e-mail de confirmation vient de vous être envoyé : ouvrez le lien pour activer votre compte.'
                : 'Compte créé. Vous pouvez vous connecter.',
            'verification_required' => $verify,
        ], 201);
    }

    /** Lien reçu par e-mail : valide la signature puis redirige vers l'écran de connexion du frontend. */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $login = rtrim((string) config('softio.frontend_url'), '/').'/login';

        if (! $request->hasValidSignature()) {
            return redirect()->away($login.'?verified=expired');
        }

        $user = User::query()->find($id);
        if ($user === null || ! hash_equals(sha1($user->email), $hash)) {
            return redirect()->away($login.'?verified=invalid');
        }

        if ($user->must_verify_email || $user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now(), 'must_verify_email' => false])->save();
            $this->audit->log('auth.email_verified', $user->company, [], $user);
        }

        return redirect()->away($login.'?verified=1');
    }

    /** Réponse identique que le compte existe ou non : on ne révèle pas les adresses inscrites. */
    public function resend(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->validate(['email' => ['required', 'string', 'email', 'max:255']])['email']));
        $user = User::query()->where('email', $email)->first();

        if ($user !== null && $user->must_verify_email && $user->is_active) {
            $this->registration->sendVerification($user);
        }

        return response()->json([
            'message' => 'Si un compte en attente de confirmation existe pour cette adresse, un nouvel e-mail vient d\'être envoyé.',
        ], 202);
    }
}
