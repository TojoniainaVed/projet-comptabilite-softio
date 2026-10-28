<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Statistiques d'administration. Un super administrateur voit toute la plateforme,
 * un administrateur d'entreprise uniquement son entreprise.
 */
class AdminDashboardService
{
    /** @return array<string, mixed> */
    public function summary(User $viewer): array
    {
        $users = User::query()->visibleTo($viewer);
        $platform = $viewer->isPlatformAdmin();

        $totalUsers = (clone $users)->count();
        $activeUsers = (clone $users)->where('is_active', true)->count();
        $neverLoggedIn = (clone $users)->where('is_active', true)->whereNull('last_login_at')->count();

        $logs = AuditLog::query()->when(! $platform, fn ($q) => $q->where('company_id', $viewer->company_id));

        $alerts = [];
        if ($neverLoggedIn > 0) {
            $alerts[] = ['level' => 'info', 'message' => "$neverLoggedIn utilisateur(s) actif(s) ne se sont jamais connectés."];
        }
        if ($platform) {
            $suspended = Company::query()->where('status', Company::STATUS_SUSPENDED)->count();
            if ($suspended > 0) {
                $alerts[] = ['level' => 'warning', 'message' => "$suspended entreprise(s) suspendue(s)."];
            }
        }
        $failedLogins = (clone $logs)->where('action', 'auth.login_failed')->where('created_at', '>=', now()->subDay())->count();
        if ($failedLogins >= 5) {
            $alerts[] = ['level' => 'warning', 'message' => "$failedLogins échecs de connexion au cours des dernières 24 h."];
        }

        return [
            'scope' => $platform ? 'platform' : 'company',
            'users_total' => $totalUsers,
            'users_active' => $activeUsers,
            'companies_total' => $platform ? Company::query()->count() : null,
            'active_sessions' => $this->activeSessions($users),
            'recent_logins' => (clone $users)->whereNotNull('last_login_at')
                ->orderByDesc('last_login_at')->limit(5)
                ->get(['id', 'name', 'email', 'last_login_at'])
                ->map(fn (User $u) => [
                    'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
                    'last_login_at' => $u->last_login_at?->toIso8601String(),
                ])->all(),
            'recent_activity' => (clone $logs)->with('user:id,name')->latest('id')->limit(8)->get()
                ->map(fn (AuditLog $l) => [
                    'id' => $l->id, 'action' => $l->action, 'user' => $l->user?->name,
                    'created_at' => $l->created_at?->toIso8601String(),
                ])->all(),
            'logins_by_day' => $this->loginsByDay($logs),
            'alerts' => $alerts,
        ];
    }

    private function activeSessions($users): int
    {
        return PersonalAccessToken::query()
            ->where('tokenable_type', (new User)->getMorphClass())
            ->whereIn('tokenable_id', (clone $users)->select('id'))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();
    }

    /** @return list<array{date:string, count:int}> connexions réussies sur 7 jours */
    private function loginsByDay($logs): array
    {
        $start = CarbonImmutable::today()->subDays(6);

        $counts = (clone $logs)->where('action', 'auth.login')
            ->where('created_at', '>=', $start)
            ->get(['created_at'])
            ->groupBy(fn (AuditLog $l) => $l->created_at->format('Y-m-d'))
            ->map->count();

        return collect(range(0, 6))->map(fn (int $i) => [
            'date' => $start->addDays($i)->format('Y-m-d'),
            'count' => (int) ($counts[$start->addDays($i)->format('Y-m-d')] ?? 0),
        ])->all();
    }
}
