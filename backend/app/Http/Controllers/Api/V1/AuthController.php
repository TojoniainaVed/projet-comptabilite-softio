<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Softio\SoftioSsoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->with(['role', 'company'])->where('email', $request->string('email')->lower()->value())->first();

        $valid = $user !== null
            && Hash::check($request->string('password')->value(), $user->password)
            && $user->is_active
            && ($user->company === null || $user->company->isActive());

        if (! $valid) {
            // Même réponse dans tous les cas : on ne révèle pas si le compte existe ou est désactivé.
            $this->audit->log('auth.login_failed', $user, ['email' => $request->string('email')->value()], $user);

            throw ValidationException::withMessages(['email' => ['Identifiants invalides.']]);
        }

        // Compte inscrit en libre-service dont l'adresse n'est pas encore confirmée. Ce message n'est donné
        // qu'après un mot de passe correct : il ne révèle donc pas l'existence d'un compte à un tiers.
        if ($user->must_verify_email) {
            throw new BusinessRuleException(
                'Confirmez votre adresse e-mail avant de vous connecter : ouvrez le lien reçu par e-mail.',
                'email_not_verified',
            );
        }

        return $this->ouvrirSession($user, $request->string('device_name', 'web')->value());
    }

    /** Connexion depuis Softio : le code reçu dans l'URL est échangé auprès de Softio. */
    public function sso(Request $request, SoftioSsoService $sso): JsonResponse
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:255']]);

        $user = $sso->connecter($validated['code']);

        return $this->ouvrirSession($user, 'softio', ['via' => 'softio']);
    }

    /** @param array<string, mixed> $contexte */
    private function ouvrirSession(User $user, string $device, array $contexte = []): JsonResponse
    {
        $token = $user->createToken(
            $device,
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration')),
        );
        $user->forceFill(['last_login_at' => now()])->save();
        $this->audit->log('auth.login', $user, $contexte, $user);

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $this->payload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->payload($request->user()->load(['role', 'company']))]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
        $this->audit->log('auth.logout');

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function payload(User $user): array
    {
        return UserResource::make($user)->resolve() + [
            'permissions' => $user->permissionSlugs(),
            // Compte venu de Softio : à la déconnexion, le front le renvoie vers Softio
            'from_softio' => $user->softio_user_id !== null,
        ];
    }
}
