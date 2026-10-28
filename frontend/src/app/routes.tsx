import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { NotFoundPage } from '@/features/auth/ErrorPages'
import {
  HomeRedirect,
  RequireAdminAccess,
  RequireAuth,
  RequireCompany,
  RequirePermission,
} from '@/features/auth/guards'

/** Chargement différé d'une page : chaque écran est un fragment séparé du bundle. */
function page<P extends object>(
  load: () => Promise<ComponentType<P>>,
  props?: P,
): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const Page = await load()
      return { Component: () => <Page {...(props as P)} /> }
    },
  }
}

const guard = (permission: string, children: RouteObject[]): RouteObject => ({
  element: <RequirePermission permission={permission} />,
  children,
})

export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireCompany />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomeRedirect /> },
              guard('reports.view', [
                {
                  path: 'dashboard',
                  ...page(() =>
                    import('@/features/dashboard/DashboardPage').then((m) => m.DashboardPage),
                  ),
                },
                {
                  path: 'reports',
                  ...page(() =>
                    import('@/features/reports/ReportsPage').then((m) => m.ReportsPage),
                  ),
                },
                {
                  path: 'treasury',
                  ...page(() =>
                    import('@/features/reports/TreasuryPage').then((m) => m.TreasuryPage),
                  ),
                },
              ]),
              guard('accounts.view', [
                {
                  path: 'accounts',
                  ...page(() =>
                    import('@/features/accounts/AccountsPage').then((m) => m.AccountsPage),
                  ),
                },
              ]),
              guard('entries.view', [
                {
                  path: 'journal-entries',
                  ...page(() =>
                    import('@/features/entries/JournalEntriesPage').then(
                      (m) => m.JournalEntriesPage,
                    ),
                  ),
                },
                {
                  path: 'journal-entries/:id',
                  ...page(() =>
                    import('@/features/entries/JournalEntryDetailPage').then(
                      (m) => m.JournalEntryDetailPage,
                    ),
                  ),
                },
              ]),
              guard('entries.create', [
                {
                  path: 'journal-entries/new',
                  ...page(() =>
                    import('@/features/entries/JournalEntryFormPage').then(
                      (m) => m.JournalEntryFormPage,
                    ),
                  ),
                },
              ]),
              guard('entries.update', [
                {
                  path: 'journal-entries/:id/edit',
                  ...page(() =>
                    import('@/features/entries/JournalEntryFormPage').then(
                      (m) => m.JournalEntryFormPage,
                    ),
                  ),
                },
              ]),
              guard('partners.view', [
                {
                  path: 'customers',
                  ...page(
                    () => import('@/features/partners/PartnersPage').then((m) => m.PartnersPage),
                    { kind: 'customer' as const },
                  ),
                },
                {
                  path: 'suppliers',
                  ...page(
                    () => import('@/features/partners/PartnersPage').then((m) => m.PartnersPage),
                    { kind: 'supplier' as const },
                  ),
                },
              ]),
              guard('invoices.view', [
                {
                  path: 'sales/invoices',
                  ...page(
                    () => import('@/features/invoices/InvoicesPage').then((m) => m.InvoicesPage),
                    { kind: 'customer' as const },
                  ),
                },
                {
                  path: 'sales/invoices/:id',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceDetailPage').then(
                        (m) => m.InvoiceDetailPage,
                      ),
                    { kind: 'customer' as const },
                  ),
                },
                {
                  path: 'purchases/invoices',
                  ...page(
                    () => import('@/features/invoices/InvoicesPage').then((m) => m.InvoicesPage),
                    { kind: 'supplier' as const },
                  ),
                },
                {
                  path: 'purchases/invoices/:id',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceDetailPage').then(
                        (m) => m.InvoiceDetailPage,
                      ),
                    { kind: 'supplier' as const },
                  ),
                },
              ]),
              guard('invoices.create', [
                {
                  path: 'sales/invoices/new',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceFormPage').then((m) => m.InvoiceFormPage),
                    { kind: 'customer' as const },
                  ),
                },
                {
                  path: 'purchases/invoices/new',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceFormPage').then((m) => m.InvoiceFormPage),
                    { kind: 'supplier' as const },
                  ),
                },
              ]),
              guard('invoices.update', [
                {
                  path: 'sales/invoices/:id/edit',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceFormPage').then((m) => m.InvoiceFormPage),
                    { kind: 'customer' as const },
                  ),
                },
                {
                  path: 'purchases/invoices/:id/edit',
                  ...page(
                    () =>
                      import('@/features/invoices/InvoiceFormPage').then((m) => m.InvoiceFormPage),
                    { kind: 'supplier' as const },
                  ),
                },
              ]),
              guard('payments.view', [
                {
                  path: 'payments',
                  ...page(() =>
                    import('@/features/payments/PaymentsPage').then((m) => m.PaymentsPage),
                  ),
                },
              ]),
              guard('expenses.view', [
                {
                  path: 'expenses',
                  ...page(() =>
                    import('@/features/expenses/ExpensesPage').then((m) => m.ExpensesPage),
                  ),
                },
              ]),
              guard('journals.view', [
                {
                  path: 'settings',
                  ...page(() =>
                    import('@/features/settings/AccountingSettingsPage').then(
                      (m) => m.AccountingSettingsPage,
                    ),
                  ),
                },
              ]),
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireAdminAccess />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              guard('users.view', [
                {
                  index: true,
                  ...page(() =>
                    import('@/features/administration/AdminDashboardPage').then(
                      (m) => m.AdminDashboardPage,
                    ),
                  ),
                },
                {
                  path: 'users',
                  ...page(() =>
                    import('@/features/administration/UsersPage').then((m) => m.UsersPage),
                  ),
                },
              ]),
              guard('roles.view', [
                {
                  path: 'roles',
                  ...page(() =>
                    import('@/features/administration/RolesPage').then((m) => m.RolesPage),
                  ),
                },
              ]),
              guard('companies.view', [
                {
                  path: 'companies',
                  ...page(() =>
                    import('@/features/administration/CompaniesPage').then((m) => m.CompaniesPage),
                  ),
                },
              ]),
              guard('settings.view', [
                {
                  path: 'settings',
                  ...page(() =>
                    import('@/features/administration/AdminSettingsPage').then(
                      (m) => m.AdminSettingsPage,
                    ),
                  ),
                },
              ]),
              guard('audit.view', [
                {
                  path: 'audit-logs',
                  ...page(() =>
                    import('@/features/administration/AuditLogsPage').then((m) => m.AuditLogsPage),
                  ),
                },
              ]),
              guard('sessions.view', [
                {
                  path: 'sessions',
                  ...page(() =>
                    import('@/features/administration/SessionsPage').then((m) => m.SessionsPage),
                  ),
                },
              ]),
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]
