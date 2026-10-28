<?php

return [
    // API par jetons uniquement (pas d'authentification SPA par cookie).
    'stateful' => [],
    'guard' => [],
    'expiration' => (int) env('SANCTUM_EXPIRATION', 480),
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
    'middleware' => [],
];
