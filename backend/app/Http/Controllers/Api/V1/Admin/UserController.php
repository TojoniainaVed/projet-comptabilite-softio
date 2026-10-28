<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Admin\UserAdminGuard;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly UserAdminGuard $guard,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $query = User::query()
            ->visibleTo($request->user())
            ->with(['role', 'company'])
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where(
                fn ($w) => $w->where('name', 'like', $this->like($term))->orWhere('email', 'like', $this->like($term))
            ))
            ->when($request->filled('role_id'), fn ($q) => $q->where('role_id', $request->integer('role_id')))
            ->when($request->filled('company_id') && $request->user()->isPlatformAdmin(), fn ($q) => $q->where('company_id', $request->integer('company_id')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name');

        return $this->listResponse($request, $query, UserResource::class);
    }

    public function store(UserRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $user = User::create($request->payload() + ['is_active' => true]);
        $this->audit->log('user.created', $user, ['email' => $user->email, 'role_id' => $user->role_id]);

        return UserResource::make($user->load(['role', 'company']))->response()->setStatusCode(201);
    }

    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return UserResource::make($user->load(['role', 'company']));
    }

    public function update(UserRequest $request, User $user): UserResource
    {
        $this->authorize('update', $user);

        $data = $request->payload();
        $this->guard->assertNotLastAdmin($user, $data);

        $user->fill($data);
        $changed = array_keys($user->getDirty());
        $user->save();

        if ($changed !== []) {
            // Seuls les noms des champs modifiés sont journalisés, jamais leurs valeurs (mot de passe inclus).
            $this->audit->log('user.updated', $user, ['fields' => $changed]);
            if (in_array('role_id', $changed, true)) {
                $this->audit->log('user.role_changed', $user, ['role_id' => $user->role_id]);
            }
        }

        return UserResource::make($user->load(['role', 'company']));
    }

    /** Active ou désactive un compte ; la désactivation révoque aussitôt toutes ses sessions. */
    public function updateStatus(Request $request, User $user): UserResource
    {
        $this->authorize('administer', $user);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $this->guard->assertNotLastAdmin($user, ['is_active' => (bool) $data['is_active']]);

        $user->update(['is_active' => $data['is_active']]);
        if (! $user->is_active) {
            $user->tokens()->delete();
        }
        $this->audit->log($user->is_active ? 'user.activated' : 'user.deactivated', $user);

        return UserResource::make($user->load(['role', 'company']));
    }
}
