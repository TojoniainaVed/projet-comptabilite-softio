<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Isolation stricte des données par entreprise.
 *
 * Tout modèle comptable est filtré sur l'entreprise de l'utilisateur authentifié.
 * Un utilisateur sans entreprise (super administrateur) ne voit AUCUNE donnée comptable.
 * Une ressource d'une autre entreprise est donc introuvable (404), jamais interdite (403),
 * afin de ne pas révéler son existence.
 */
class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::user();

        if ($user === null) {
            return; // contexte console (seeders, migrations) ou route publique
        }

        if ($user->company_id === null) {
            $builder->whereRaw('1 = 0');

            return;
        }

        $builder->where($model->qualifyColumn('company_id'), $user->company_id);
    }
}
