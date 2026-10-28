<?php

return [
    // Valeurs par défaut des paramètres de plateforme (modifiables via /api/v1/admin/settings).
    'defaults' => [
        'platform_name' => 'Softio Comptabilité',
        'brand_color' => '#2563eb',
        'default_locale' => 'fr',
        'default_currency' => 'MGA',
        'password_min_length' => 12,
        'features' => [
            'expenses' => true,
        ],
    ],

    // Adresse publique du frontend : sert aux liens envoyés par e-mail (réinitialisation de mot de passe).
    'frontend_url' => rtrim(trim(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))[0]), '/'),

    // Inscription en libre-service.
    'registration' => [
        'enabled' => (bool) env('REGISTRATION_ENABLED', true),
        // Si true, un compte inscrit seul doit confirmer son adresse e-mail avant de se connecter.
        'require_email_verification' => (bool) env('REGISTRATION_REQUIRE_EMAIL_VERIFICATION', true),
        // Adresse de vos conditions d'utilisation (facultatif) : affichée sur la page d'inscription.
        'terms_url' => env('TERMS_URL'),
    ],

    'pagination' => [
        'default' => 15,
        'max' => 100,
    ],
];
