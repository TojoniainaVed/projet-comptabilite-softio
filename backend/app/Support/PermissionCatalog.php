<?php

namespace App\Support;

/**
 * Catalogue unique des permissions (`ressource.action`) et des rôles initiaux.
 * Les actions : view (consulter), create, update, validate, cancel, export, administer.
 */
final class PermissionCatalog
{
    public const SUPER_ADMIN = 'super-admin';

    public const COMPANY_ADMIN = 'company-admin';

    public const PLATFORM = 'platform';

    public const COMPANY = 'company';

    /** @var array<string, list<string>> */
    private const RESOURCES = [
        'accounts' => ['view', 'create', 'update'],
        'journals' => ['view', 'create', 'update'],
        'fiscal_years' => ['view', 'create', 'update'],
        'entries' => ['view', 'create', 'update', 'validate', 'cancel', 'export'],
        'partners' => ['view', 'create', 'update'],
        'invoices' => ['view', 'create', 'update', 'validate', 'cancel', 'export'],
        'payments' => ['view', 'create'],
        'expenses' => ['view', 'create', 'update', 'validate'],
        'reports' => ['view', 'export'],
        'users' => ['view', 'create', 'update', 'administer'],
        'roles' => ['view', 'administer'],
        'companies' => ['view', 'create', 'update', 'administer'],
        'settings' => ['view', 'update'],
        'audit' => ['view'],
        'sessions' => ['view', 'administer'],
    ];

    /** @var list<string> */
    private const ACCOUNTING_RESOURCES = [
        'accounts', 'journals', 'fiscal_years', 'entries', 'partners',
        'invoices', 'payments', 'expenses', 'reports',
    ];

    /** @return list<string> */
    public static function all(): array
    {
        $slugs = [];
        foreach (self::RESOURCES as $resource => $actions) {
            foreach ($actions as $action) {
                $slugs[] = "$resource.$action";
            }
        }

        return $slugs;
    }

    /** @return list<string> */
    private static function accounting(array $only = [], array $exceptActions = []): array
    {
        return array_values(array_filter(
            self::all(),
            function (string $slug) use ($only, $exceptActions): bool {
                [$resource, $action] = explode('.', $slug);

                return in_array($resource, $only ?: self::ACCOUNTING_RESOURCES, true)
                    && ! in_array($action, $exceptActions, true);
            }
        ));
    }

    /** @return list<string> */
    private static function viewOnly(): array
    {
        return array_map(fn (string $r) => "$r.view", self::ACCOUNTING_RESOURCES);
    }

    /**
     * @return array<string, array{name: string, scope: string, description: string, permissions: list<string>}>
     */
    public static function defaultRoles(): array
    {
        return [
            self::SUPER_ADMIN => [
                'name' => 'Super administrateur',
                'scope' => self::PLATFORM,
                'description' => 'Administre la plateforme : entreprises, utilisateurs, paramètres, audit. Aucun accès aux données comptables des entreprises.',
                'permissions' => [
                    'users.view', 'users.create', 'users.update', 'users.administer',
                    'roles.view', 'roles.administer',
                    'companies.view', 'companies.create', 'companies.update', 'companies.administer',
                    'settings.view', 'settings.update',
                    'audit.view', 'sessions.view', 'sessions.administer',
                ],
            ],
            self::COMPANY_ADMIN => [
                'name' => "Administrateur d'entreprise",
                'scope' => self::COMPANY,
                'description' => "Gère les utilisateurs et la configuration de son entreprise, avec accès complet à la comptabilité.",
                'permissions' => array_merge(
                    self::accounting(),
                    [
                        'users.view', 'users.create', 'users.update', 'users.administer',
                        'roles.view', 'companies.view', 'companies.update',
                        'audit.view', 'sessions.view', 'sessions.administer',
                    ],
                ),
            ],
            'accountant' => [
                'name' => 'Comptable',
                'scope' => self::COMPANY,
                'description' => 'Saisit les écritures, les factures, les paiements et les dépenses.',
                'permissions' => array_merge(
                    self::accounting(exceptActions: ['cancel', 'export']),
                    ['reports.view'],
                ),
            ],
            'finance-manager' => [
                'name' => 'Responsable financier',
                'scope' => self::COMPANY,
                'description' => 'Valide, annule et exporte. Consulte tous les rapports.',
                'permissions' => self::accounting(),
            ],
            'billing-manager' => [
                'name' => 'Gestionnaire de facturation',
                'scope' => self::COMPANY,
                'description' => 'Gère les partenaires, les factures et les paiements.',
                'permissions' => array_merge(
                    ['accounts.view', 'journals.view'],
                    self::accounting(only: ['partners', 'payments']),
                    self::accounting(only: ['invoices'], exceptActions: ['cancel', 'export']),
                ),
            ],
            'auditor' => [
                'name' => 'Lecteur / auditeur',
                'scope' => self::COMPANY,
                'description' => 'Consulte la comptabilité et exporte les rapports, sans pouvoir modifier.',
                'permissions' => array_merge(
                    self::viewOnly(),
                    ['entries.export', 'invoices.export', 'reports.export', 'audit.view'],
                ),
            ],
        ];
    }
}
