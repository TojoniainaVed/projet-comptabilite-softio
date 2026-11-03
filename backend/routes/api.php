<?php

use App\Http\Controllers\Api\V1\Accounting;
use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\PlatformController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 — préfixe effectif : /api/v1
|--------------------------------------------------------------------------
| Chaque contrôleur vérifie les autorisations (Gates / Policies) : masquer un bouton
| dans l'interface n'est jamais une protection.
*/

Route::prefix('v1')->group(function (): void {
    // Public
    Route::get('platform', [PlatformController::class, 'show']);
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    // Inscription libre-service, confirmation d'e-mail, mot de passe oublié
    Route::post('auth/register', [Auth\RegistrationController::class, 'register'])->middleware('throttle:register');
    Route::get('auth/email/verify/{id}/{hash}', [Auth\RegistrationController::class, 'verify'])
        ->whereNumber('id')->middleware('throttle:api')->name('verification.verify');
    Route::post('auth/email/resend', [Auth\RegistrationController::class, 'resend'])->middleware('throttle:account-mail');
    Route::post('auth/password/forgot', [Auth\PasswordResetController::class, 'forgot'])->middleware('throttle:account-mail');
    Route::post('auth/password/reset', [Auth\PasswordResetController::class, 'reset'])->middleware('throttle:login');

    // Authentifié et compte actif
    Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // ---------------------------------------------------------------
        // Espace d'administration
        // ---------------------------------------------------------------
        Route::prefix('admin')->group(function (): void {
            Route::get('dashboard', Admin\DashboardController::class);

            Route::patch('users/{user}/status', [Admin\UserController::class, 'updateStatus']);
            Route::apiResource('users', Admin\UserController::class)->except('destroy');

            Route::get('roles', [Admin\RoleController::class, 'index']);
            Route::get('permissions', [Admin\RoleController::class, 'permissions']);
            Route::put('roles/{role}/permissions', [Admin\RoleController::class, 'updatePermissions']);

            Route::apiResource('companies', Admin\CompanyController::class)->except('destroy');

            Route::get('settings', [Admin\SettingController::class, 'show']);
            Route::put('settings', [Admin\SettingController::class, 'update']);

            Route::get('audit-logs', [Admin\AuditLogController::class, 'index']);

            Route::get('sessions', [Admin\SessionController::class, 'index']);
            Route::delete('sessions/{session}', [Admin\SessionController::class, 'destroy']);
        });

        // ---------------------------------------------------------------
        // Espace comptable (réservé aux comptes rattachés à une entreprise)
        // ---------------------------------------------------------------
        Route::middleware('company')->group(function (): void {
            Route::get('dashboard', Accounting\DashboardController::class);

            Route::apiResource('accounts', Accounting\AccountController::class)->except('destroy');
            Route::apiResource('journals', Accounting\JournalController::class)->only(['index', 'store', 'update']);
            Route::apiResource('fiscal-years', Accounting\FiscalYearController::class)->only(['index', 'store', 'update']);

            Route::get('journal-entries/export', [Accounting\JournalEntryController::class, 'export']);
            Route::post('journal-entries/{journal_entry}/post', [Accounting\JournalEntryController::class, 'post']);
            Route::post('journal-entries/{journal_entry}/reverse', [Accounting\JournalEntryController::class, 'reverse']);
            Route::apiResource('journal-entries', Accounting\JournalEntryController::class);

            // Clients et fournisseurs : même contrôleur, type fourni par le défaut de route.
            foreach (['customers' => 'customer', 'suppliers' => 'supplier'] as $uri => $type) {
                Route::get($uri, [Accounting\PartnerController::class, 'index'])->defaults('type', $type);
                Route::post($uri, [Accounting\PartnerController::class, 'store'])->defaults('type', $type);
                Route::get("$uri/{id}", [Accounting\PartnerController::class, 'show'])->whereNumber('id')->defaults('type', $type);
                Route::put("$uri/{id}", [Accounting\PartnerController::class, 'update'])->whereNumber('id')->defaults('type', $type);
                Route::delete("$uri/{id}", [Accounting\PartnerController::class, 'destroy'])->whereNumber('id')->defaults('type', $type);
            }

            Route::post('invoices/{invoice}/post', [Accounting\InvoiceController::class, 'post']);
            Route::post('invoices/{invoice}/cancel', [Accounting\InvoiceController::class, 'cancel']);
            Route::post('invoices/{invoice}/payments', [Accounting\InvoiceController::class, 'pay']);
            Route::apiResource('invoices', Accounting\InvoiceController::class);

            Route::apiResource('payments', Accounting\PaymentController::class)->only(['index', 'show']);

            Route::post('expenses/{expense}/post', [Accounting\ExpenseController::class, 'post']);
            Route::apiResource('expenses', Accounting\ExpenseController::class);

            Route::prefix('reports')->group(function (): void {
                Route::get('trial-balance', [Accounting\ReportController::class, 'trialBalance']);
                Route::get('income-statement', [Accounting\ReportController::class, 'incomeStatement']);
                Route::get('balance-sheet', [Accounting\ReportController::class, 'balanceSheet']);
                Route::get('treasury', [Accounting\ReportController::class, 'treasury']);
            });
        });
    });
});