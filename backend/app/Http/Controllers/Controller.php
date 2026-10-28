<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

abstract class Controller
{
    use AuthorizesRequests;

    /**
     * Liste paginée côté serveur (`page`, `per_page` ≤ 100).
     * Avec `all=1`, renvoie jusqu'à 500 éléments sans pagination : réservé aux listes de choix des formulaires.
     *
     * @param  class-string<\Illuminate\Http\Resources\Json\JsonResource>  $resource
     */
    protected function listResponse(Request $request, Builder $query, string $resource): AnonymousResourceCollection
    {
        if ($request->boolean('all')) {
            return $resource::collection($query->limit(500)->get());
        }

        $perPage = min(max($request->integer('per_page', config('softio.pagination.default')), 1), config('softio.pagination.max'));

        return $resource::collection($query->paginate($perPage)->withQueryString());
    }

    protected function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    /** Échappe les jokers LIKE d'une recherche libre. */
    protected function like(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }
}
