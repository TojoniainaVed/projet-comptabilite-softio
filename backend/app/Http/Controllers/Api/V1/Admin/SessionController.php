<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/** Sessions actives = jetons d'API non expirés. */
class SessionController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('sessions.view');

        $current = $request->user()->currentAccessToken();
        $currentId = $current instanceof PersonalAccessToken ? $current->getKey() : null;
        $sessions = $this->visibleTokens($request->user())
            ->with('tokenable:id,name,email')
            ->latest('last_used_at')->latest('id')
            ->limit(200)->get()
            ->map(fn (PersonalAccessToken $t) => [
                'id' => $t->id,
                'device' => $t->name,
                'user' => ['id' => $t->tokenable?->id, 'name' => $t->tokenable?->name, 'email' => $t->tokenable?->email],
                'last_used_at' => $t->last_used_at?->toIso8601String(),
                'created_at' => $t->created_at?->toIso8601String(),
                'expires_at' => $t->expires_at?->toIso8601String(),
                'is_current' => $t->id === $currentId,
            ]);

        return response()->json(['data' => $sessions]);
    }

    public function destroy(Request $request, int $session): JsonResponse
    {
        $this->authorize('sessions.administer');

        $token = $this->visibleTokens($request->user())->whereKey($session)->firstOrFail();
        $this->audit->log('session.revoked', $token->tokenable, ['session_id' => $token->id]);
        $token->delete();

        return $this->noContent();
    }

    /** Jetons non expirés des utilisateurs visibles par $viewer. */
    private function visibleTokens(User $viewer)
    {
        return PersonalAccessToken::query()
            ->where('tokenable_type', (new User)->getMorphClass())
            ->whereIn('tokenable_id', User::query()->visibleTo($viewer)->select('id'))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }
}
