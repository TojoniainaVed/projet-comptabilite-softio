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

    // Connexion depuis Softio (projet principal) : l'utilisateur arrive avec un code temporaire,
    // échangé de serveur à serveur contre ses infos et son accès au module.
    'sso' => [
        // Adresse de l'API Softio, ex. http://localhost:8000/api
        'api_url' => rtrim((string) env('SOFTIO_API_URL', 'http://localhost:8000/api'), '/'),
        // Même valeur que SSO_SECRET dans le .env de Softio
        'secret' => env('SOFTIO_SSO_SECRET'),
        // Id du module Compta dans Softio : un code émis pour un autre module est refusé
        'module_id' => env('SOFTIO_MODULE_ID') !== null ? (int) env('SOFTIO_MODULE_ID') : null,
        // Revérifie l'accès auprès de Softio au plus toutes les N minutes
        'verifier_toutes_les' => (int) env('SOFTIO_SSO_VERIFIER_MINUTES', 10),
        // Rôle donné aux utilisateurs Softio qui ne sont pas le propriétaire de l'entreprise
        'role_utilisateur' => env('SOFTIO_SSO_ROLE_UTILISATEUR', 'accountant'),
    ],

    'pagination' => [
        'default' => 15,
        'max' => 100,
    ],
];
