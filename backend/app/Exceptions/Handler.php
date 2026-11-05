<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        // Violation d'une règle métier : 422 avec un code stable exploitable par le frontend.
        $this->renderable(function (BusinessRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => $e->errorCode,
            ], 422);
        });
    }

    /**
     * L'API répond toujours en JSON.
     *
     * @param  Request  $request
     */
    protected function shouldReturnJson($request, Throwable $e): bool
    {
        return $request->is('api/*') || $request->expectsJson();
    }
}
