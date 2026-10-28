<?php

namespace App\Policies;

use App\Models\Company;
use App\Models\User;

class CompanyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('companies.view');
    }

    public function view(User $user, Company $company): bool
    {
        return $user->hasPermission('companies.view') && $this->owns($user, $company);
    }

    /** Seule la plateforme crée des entreprises. */
    public function create(User $user): bool
    {
        return $user->hasPermission('companies.create') && $user->isPlatformAdmin();
    }

    public function update(User $user, Company $company): bool
    {
        return $user->hasPermission('companies.update') && $this->owns($user, $company);
    }

    /** Changer le statut (activer / suspendre) est réservé à la plateforme. */
    public function administer(User $user, Company $company): bool
    {
        return $user->hasPermission('companies.administer') && $user->isPlatformAdmin();
    }

    private function owns(User $user, Company $company): bool
    {
        return $user->isPlatformAdmin() || $user->company_id === $company->id;
    }
}
