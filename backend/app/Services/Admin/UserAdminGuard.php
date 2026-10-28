<?php

namespace App\Services\Admin;

use App\Exceptions\BusinessRuleException;
use App\Models\User;
use App\Support\PermissionCatalog;

/**
 * Empêche de retirer le dernier administrateur actif indispensable :
 * le dernier super administrateur de la plateforme, ou le dernier administrateur d'une entreprise.
 */
class UserAdminGuard
{
    /**
     * @param  array<string, mixed>  $changes  attributs que l'on s'apprête à appliquer (is_active, role_id, company_id)
     */
    public function assertNotLastAdmin(User $target, array $changes): void
    {
        $target->loadMissing('role');

        $isAdmin = in_array($target->role?->slug, [PermissionCatalog::SUPER_ADMIN, PermissionCatalog::COMPANY_ADMIN], true);
        if (! $isAdmin || ! $target->is_active) {
            return;
        }

        $newCompany = array_key_exists('company_id', $changes) ? $changes['company_id'] : $target->company_id;
        $stillAdmin = (bool) ($changes['is_active'] ?? $target->is_active)
            && (int) ($changes['role_id'] ?? $target->role_id) === $target->role_id
            && ($newCompany === null ? null : (int) $newCompany) === $target->company_id;

        if ($stillAdmin) {
            return;
        }

        $otherAdminExists = User::query()
            ->where('role_id', $target->role_id)
            ->where('company_id', $target->company_id)
            ->where('is_active', true)
            ->whereKeyNot($target->id)
            ->exists();

        if (! $otherAdminExists) {
            throw new BusinessRuleException(
                'Impossible : il s\'agit du dernier administrateur actif. Désignez-en un autre d\'abord.',
                'last_admin'
            );
        }
    }
}
