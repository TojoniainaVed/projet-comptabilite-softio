<?php

namespace Tests\Unit;

use App\Support\PermissionCatalog;
use PHPUnit\Framework\TestCase;

class PermissionCatalogTest extends TestCase
{
    public function test_every_role_permission_exists_in_the_catalog(): void
    {
        $all = PermissionCatalog::all();

        foreach (PermissionCatalog::defaultRoles() as $slug => $role) {
            foreach ($role['permissions'] as $permission) {
                $this->assertContains($permission, $all, "Permission inconnue « $permission » dans le rôle $slug");
            }
        }
    }

    public function test_super_admin_has_no_accounting_permission(): void
    {
        $permissions = PermissionCatalog::defaultRoles()[PermissionCatalog::SUPER_ADMIN]['permissions'];

        foreach (['accounts', 'entries', 'invoices', 'payments', 'expenses', 'reports'] as $resource) {
            $this->assertEmpty(array_filter($permissions, fn ($p) => str_starts_with($p, "$resource.")));
        }
    }

    public function test_auditor_is_read_only(): void
    {
        $permissions = PermissionCatalog::defaultRoles()['auditor']['permissions'];

        foreach ($permissions as $permission) {
            $this->assertMatchesRegularExpression('/\.(view|export)$/', $permission);
        }
    }

    public function test_only_finance_manager_and_company_admin_can_validate_and_cancel_entries(): void
    {
        $roles = PermissionCatalog::defaultRoles();

        $this->assertContains('entries.cancel', $roles['finance-manager']['permissions']);
        $this->assertNotContains('entries.cancel', $roles['accountant']['permissions']);
        $this->assertNotContains('entries.validate', $roles['auditor']['permissions']);
    }
}
