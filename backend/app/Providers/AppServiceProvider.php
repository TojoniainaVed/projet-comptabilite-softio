<?php

namespace App\Providers;

use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Une Gate par permission (« accounts.view », « users.create »...), vérifiée côté serveur.
        foreach (PermissionCatalog::all() as $slug) {
            Gate::define($slug, fn (User $user): bool => $user->hasPermission($slug));
        }

        // Les policies (UserPolicy, JournalEntryPolicy...) sont découvertes par convention de nommage.

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(30)->by($request->ip()),
        ]);

        // Inscription : peu de créations de compte par adresse IP.
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(10)->by($request->ip()));

        // E-mails de confirmation / réinitialisation : évite le harcèlement d'une boîte et l'abus d'envoi.
        RateLimiter::for('account-mail', fn (Request $request) => [
            Limit::perMinute(3)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perHour(30)->by($request->ip()),
        ]);

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));
    }
}
