<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Account\AccountMailer;
use App\Services\Audit\AuditLogger;
use App\Support\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Throwable;

class PasswordResetController extends Controller
{
    public function __construct(
        private readonly AccountMailer $mailer,
        private readonly AuditLogger $audit,
    ) {}

    /** Réponse identique que le compte existe ou non. */
    public function forgot(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->validate(['email' => ['required', 'string', 'email', 'max:255']])['email']));
        $user = User::query()->where('email', $email)->first();

        if ($user !== null && $user->is_active) {
            try {
                $token = Password::broker()->createToken($user);
                $url = rtrim((string) config('softio.frontend_url'), '/').'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]);
                $this->mailer->sendPasswordReset($user, $url);
                $this->audit->log('auth.password_reset_requested', $user->company, [], $user);
            } catch (Throwable $e) {
                Log::error('Envoi du lien de réinitialisation impossible.', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'message' => 'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d\'être envoyé.',
        ], 202);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'confirmed', PasswordPolicy::rule()],
        ]);
        $data['email'] = mb_strtolower(trim($data['email']));

        $resetUser = null;
        $status = Password::broker()->reset(
            ['email' => $data['email'], 'token' => $data['token'], 'password' => $data['password'], 'password_confirmation' => $data['password']],
            function (User $user, string $password) use (&$resetUser): void {
                // Le lien reçu par e-mail prouve aussi la propriété de l'adresse.
                $user->forceFill(['password' => $password, 'email_verified_at' => $user->email_verified_at ?? now(), 'must_verify_email' => false])->save();
                $user->tokens()->delete(); // toutes les sessions ouvertes sont fermées
                $resetUser = $user;
            },
        );

        if ($status !== Password::PASSWORD_RESET || $resetUser === null) {
            throw new BusinessRuleException('Ce lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau.', 'invalid_reset_token');
        }

        $this->audit->log('auth.password_reset', $resetUser->company, [], $resetUser);

        return response()->json(['message' => 'Mot de passe modifié. Vous pouvez vous connecter.']);
    }
}
