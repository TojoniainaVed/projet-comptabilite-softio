import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  BookOpen,
  FileClock,
  FileText,
  Landmark,
  ListTree,
  Receipt,
  Settings,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/feedback/States'
import { api } from '@/lib/api-client'
import { EntryStatusBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney, formatNumber } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import type { AccountingDashboard } from '@/types/api'

export function DashboardPage() {
  const { user, can } = useAuth()
  const currency = user?.company?.currency ?? 'MGA'

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) =>
      api.get<{ data: AccountingDashboard }>('/dashboard', undefined, signal),
    select: (r) => r.data,
  })

  if (query.isLoading) return <LoadingSpinner />

  if (query.isError || !query.data)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />

  const d = query.data

  // Accès rapides affichés selon les permissions de l'utilisateur connecté.
  const quickAccess = [
    {
      label: 'Plan comptable',
      description: 'Consulter les comptes',
      to: '/accounts',
      permission: 'accounts.view',
      icon: <ListTree className="size-5" />,
    },
    {
      label: 'Écritures comptables',
      description: 'Consulter les écritures',
      to: '/journal-entries',
      permission: 'entries.view',
      icon: <BookOpen className="size-5" />,
    },
    {
      label: 'Clients',
      description: 'Consulter les clients',
      to: '/customers',
      permission: 'partners.view',
      icon: <Users className="size-5" />,
    },
    {
      label: 'Fournisseurs',
      description: 'Consulter les fournisseurs',
      to: '/suppliers',
      permission: 'partners.view',
      icon: <Truck className="size-5" />,
    },
    {
      label: 'Factures clients',
      description: 'Consulter les factures clients',
      to: '/sales/invoices',
      permission: 'invoices.view',
      icon: <FileText className="size-5" />,
    },
    {
      label: 'Factures fournisseurs',
      description: 'Consulter les factures fournisseurs',
      to: '/purchases/invoices',
      permission: 'invoices.view',
      icon: <FileText className="size-5" />,
    },
    {
      label: 'Paiements',
      description: 'Consulter les paiements',
      to: '/payments',
      permission: 'payments.view',
      icon: <Wallet className="size-5" />,
    },
    {
      label: 'Dépenses',
      description: 'Consulter les dépenses',
      to: '/expenses',
      permission: 'expenses.view',
      icon: <Receipt className="size-5" />,
    },
    {
      label: 'Rapports',
      description: 'Consulter les rapports comptables',
      to: '/reports',
      permission: 'reports.view',
      icon: <BarChart3 className="size-5" />,
    },
    {
      label: 'Paramètres comptables',
      description: 'Consulter les paramètres',
      to: '/settings',
      permission: 'journals.view',
      icon: <Settings className="size-5" />,
    },
  ].filter((item) => can(item.permission))

  const max = Math.max(1, ...d.monthly.flatMap((m) => [Number(m.revenue), Number(m.expenses)]))

  return (
    <div className="w-full space-y-4">
      {/* En-tête */}
      <PageHeader title="Tableau de bord" description={user?.company?.name} />

      {/* Indicateurs financiers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Trésorerie"
          value={formatMoney(d.treasury_total, currency)}
          icon={<Landmark className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Créances clients"
          value={formatMoney(d.receivable_outstanding, currency)}
          hint="Factures validées non soldées"
          icon={<ArrowDownCircle className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Dettes fournisseurs"
          value={formatMoney(d.payable_outstanding, currency)}
          hint="Factures validées non soldées"
          icon={<ArrowUpCircle className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Produits du mois"
          value={formatMoney(d.revenue_this_month, currency)}
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Charges du mois"
          value={formatMoney(d.expenses_this_month, currency)}
          icon={<TrendingDown className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Résultat du mois"
          value={formatMoney(d.net_result_this_month, currency)}
          hint="Produits - charges"
          icon={<Landmark className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Écritures brouillon"
          value={d.draft_entries}
          hint="À valider"
          icon={<FileClock className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Retards clients"
          value={d.overdue_customer_invoices}
          hint="Factures clients échues et impayées"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        />

        <StatCard
          label="Retards fournisseurs"
          value={d.overdue_supplier_invoices}
          hint="Factures fournisseurs échues et impayées"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        />
      </div>

      {/* Accès rapides */}
      {quickAccess.length > 0 && (
        <Card title="Accès rapides">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickAccess.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-brand-500 hover:bg-surface-secondary"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  {item.icon}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{item.label}</span>

                  <span className="block truncate text-xs text-ink-muted">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Graphiques et dernières écritures */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Produits et charges */}
        <Card title="Produits et charges — 6 derniers mois">
          <div
            role="img"
            aria-label="Histogramme des produits et des charges par mois"
            className="flex h-40 items-end gap-2"
          >
            {d.monthly.map((m) => (
              <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t-sm bg-brand-600 transition-all"
                    style={{
                      height: `${(Number(m.revenue) / max) * 100}%`,
                    }}
                  />

                  <div
                    className="w-1/2 rounded-t-sm bg-warning transition-all"
                    style={{
                      height: `${(Number(m.expenses) / max) * 100}%`,
                    }}
                  />
                </div>

                <span className="text-[11px] text-ink-muted">
                  {m.month.slice(5)}/{m.month.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-brand-600" />
              Produits
            </span>

            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-warning" />
              Charges
            </span>
          </div>

          <table className="sr-only">
            <caption>Produits et charges par mois</caption>
            <thead>
              <tr>
                <th scope="col">Mois</th>
                <th scope="col">Produits</th>
                <th scope="col">Charges</th>
              </tr>
            </thead>
            <tbody>
              {d.monthly.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{m.month}</th>
                  <td>{formatNumber(m.revenue)}</td>
                  <td>{formatNumber(m.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Dernières écritures */}
        <Card title="Dernières écritures" padded={false}>
          {d.recent_entries.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">Aucune écriture pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recent_entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/journal-entries/${e.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {e.reference ?? 'Brouillon'}
                    </Link>

                    <p className="truncate text-ink-muted">
                      {e.description} · {formatDate(e.entry_date)}
                    </p>
                  </div>

                  <EntryStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
