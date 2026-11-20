<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;

/** Synchronise permissions et rôles système avec PermissionCatalog (idempotent). */
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissionIds = [];
        foreach (PermissionCatalog::all() as $slug) {
            [$resource, $action] = explode('.', $slug);
            $permissionIds[$slug] = Permission::updateOrCreate(
                ['slug' => $slug],
                ['resource' => $resource, 'action' => $action],
            )->id;
        }

        foreach (PermissionCatalog::defaultRoles() as $slug => $definition) {
            $role = Role::updateOrCreate(['slug' => $slug], [
                'name' => $definition['name'],
                'scope' => $definition['scope'],
                'description' => $definition['description'],
                'is_system' => true,
            ]);

                       // Création initiale : attribution de toutes les permissions par défaut.
            if ($role->wasRecentlyCreated) {
                $role->permissions()->sync(
                    array_map(fn (string $p) => $permissionIds[$p], $definition['permissions'])
                );
            }

            // Ajout des nouvelles permissions Avoir sans supprimer les permissions existantes.
            $creditNotePermissions = array_filter(
                $definition['permissions'],
                fn (string $permission): bool => str_starts_with($permission, 'credit_notes.')
            );

            if ($creditNotePermissions !== []) {
                $role->permissions()->syncWithoutDetaching(
                    array_map(
                        fn (string $permission): int => $permissionIds[$permission],
                        $creditNotePermissions
                    )
                );
            }

// Ajout des nouvelles permissions Avoir sans supprimer les permissions existantes.
$creditNotePermissions = array_filter(
    $definition['permissions'],
    fn (string $permission): bool => str_starts_with($permission, 'credit_notes.')
);

if ($creditNotePermissions !== []) {
    $role->permissions()->syncWithoutDetaching(
        array_map(
            fn (string $permission): int => $permissionIds[$permission],
            $creditNotePermissions
        )
    );
}
        }
    }
}
