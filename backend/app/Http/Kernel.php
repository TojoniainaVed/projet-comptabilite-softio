<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    /**
     * Middleware exécutés à chaque requête.
     *
     * @var array<int, class-string|string>
     */
    protected $middleware = [
        \Illuminate\Http\Middleware\TrustProxies::class,
        \Illuminate\Http\Middleware\HandleCors::class,
        \Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance::class,
        \Illuminate\Foundation\Http\Middleware\ValidatePostSize::class,
        \App\Http\Middleware\TrimStrings::class,
        \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
    ];

    /**
     * Le groupe « api » ne limite pas le débit : chaque route choisit son limiteur (throttle:login, throttle:api...).
     *
     * @var array<string, array<int, class-string|string>>
     */
    protected $middlewareGroups = [
        'api' => [
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];

    /**
     * @var array<string, class-string|string>
     */
    protected $middlewareAliases = [
        'auth' => \Illuminate\Auth\Middleware\Authenticate::class,
        'can' => \Illuminate\Auth\Middleware\Authorize::class,
        'signed' => \Illuminate\Routing\Middleware\ValidateSignature::class,
        'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'active' => \App\Http\Middleware\EnsureUserIsActive::class,
        'company' => \App\Http\Middleware\EnsureCompanyContext::class,
        'softio' => \App\Http\Middleware\EnsureSoftioAccess::class,
    ];
}
