<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('users.view');
    }

    public function view(User $user, User $target): bool
    {
        return $user->hasPermission('users.view') && $this->manages($user, $target);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('users.create');
    }

    public function update(User $user, User $target): bool
    {
        return $user->hasPermission('users.update') && $this->manages($user, $target);
    }

    /** Activer / désactiver un compte. On ne peut pas se désactiver soi-même. */
    public function administer(User $user, User $target): bool
    {
        return $user->hasPermission('users.administer')
            && $this->manages($user, $target)
            && $user->id !== $target->id;
    }

    /** Un administrateur de plateforme gère tout le monde ; un administrateur d'entreprise, sa propre entreprise. */
    private function manages(User $user, User $target): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        return $user->company_id !== null
            && $target->company_id === $user->company_id
            && ! $target->isPlatformAdmin();
    }
}
