<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * L'espace comptable n'existe que dans le contexte d'une entreprise.
 * Les comptes de plateforme (super administrateur) n'y ont volontairement pas accès.
 */
class EnsureCompanyContext
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->company_id === null) {
            return response()->json([
                'message' => "L'espace comptable nécessite un compte rattaché à une entreprise.",
                'code' => 'company_required',
            ], 403);
        }

        return $next($request);
    }
}
