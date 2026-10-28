<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;

class RolePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('roles.view');
    }

    /**
     * Les rôles sont globaux (partagés par toutes les entreprises) : seule la plateforme les modifie,
     * et le rôle super-admin est figé afin de ne jamais verrouiller l'administration.
     */
    public function updatePermissions(User $user, Role $role): bool
    {
        return $user->hasPermission('roles.administer')
            && $user->isPlatformAdmin()
            && $role->slug !== PermissionCatalog::SUPER_ADMIN;
    }
}
