<?php

namespace App\Http\Middleware;

use App\Services\Softio\SoftioClient;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pour les comptes venant de Softio : revérifie régulièrement que l'abonnement au module
 * est toujours actif. Sinon la session est fermée. Les comptes locaux ne sont pas concernés.
 */
class EnsureSoftioAccess
{
    public function __construct(private readonly SoftioClient $softio) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $softioUserId = $user?->softio_user_id;

        if ($softioUserId === null) {
            return $next($request);
        }

        $cle = "softio-acces:{$softioUserId}";
        $actif = Cache::get($cle);

        if ($actif === null) {
            $actif = $this->softio->accesActif((int) $softioUserId);

            // Softio injoignable : on laisse passer et on réessaie à la prochaine requête
            if ($actif === null) {
                return $next($request);
            }

            Cache::put($cle, $actif, now()->addMinutes(max(1, (int) config('softio.sso.verifier_toutes_les'))));
        }

        if (! $actif) {
            $token = $user->currentAccessToken();
            if ($token instanceof PersonalAccessToken) {
                $token->delete();
            }

            return response()->json([
                'message' => "Votre abonnement au module Comptabilité n'est plus actif. Renouvelez-le depuis Softio.",
                'code' => 'softio_access_inactive',
            ], 403);
        }

        return $next($request);
    }
}
