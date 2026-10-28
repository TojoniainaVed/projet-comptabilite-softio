<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Un compte désactivé (ou dont l'entreprise est suspendue) perd immédiatement l'accès,
 * même avec un jeton encore valide.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null) {
            $user->loadMissing('company');
            $companySuspended = $user->company !== null && ! $user->company->isActive();

            if (! $user->is_active || $companySuspended) {
                $token = $user->currentAccessToken();
                if ($token instanceof PersonalAccessToken) {
                    $token->delete();
                }

                return response()->json([
                    'message' => 'Ce compte est désactivé.',
                    'code' => 'account_disabled',
                ], 403);
            }
        }

        return $next($request);
    }
}
