<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\RolePermissionsRequest;
use App\Http\Resources\RoleResource;
use App\Models\Permission;
use App\Models\Role;
use App\Services\Audit\AuditLogger;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RoleController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Role::class);

        $roles = Role::query()
            ->with('permissions')
            ->withCount('users')
            // Un administrateur d'entreprise ne voit que les rôles d'entreprise.
            ->when(! $request->user()->isPlatformAdmin(), fn ($q) => $q->where('scope', PermissionCatalog::COMPANY))
            ->orderBy('id')
            ->get();

        return RoleResource::collection($roles);
    }

    /** Catalogue des permissions, groupé par ressource. */
    public function permissions(): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        $grouped = Permission::query()->orderBy('resource')->orderBy('id')->get()
            ->groupBy('resource')
            ->map(fn ($items, $resource) => ['resource' => $resource, 'actions' => $items->pluck('action')->values()])
            ->values();

        return response()->json(['data' => $grouped]);
    }

    public function updatePermissions(RolePermissionsRequest $request, Role $role): RoleResource
    {
        $this->authorize('updatePermissions', $role);

        $before = $role->permissions()->pluck('slug')->sort()->values()->all();
        $ids = Permission::query()->whereIn('slug', $request->validated('permissions'))->pluck('id');
        $role->permissions()->sync($ids);
        $after = $role->permissions()->pluck('slug')->sort()->values()->all();

        $this->audit->log('role.permissions_changed', $role, [
            'role' => $role->slug,
            'added' => array_values(array_diff($after, $before)),
            'removed' => array_values(array_diff($before, $after)),
        ]);

        return RoleResource::make($role->load('permissions')->loadCount('users'));
    }
}
