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

            // Création initiale uniquement : les ajustements faits ensuite par un administrateur sont conservés.
            if ($role->wasRecentlyCreated) {
                $role->permissions()->sync(array_map(fn (string $p) => $permissionIds[$p], $definition['permissions']));
            }
        }
    }
}
