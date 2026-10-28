import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileClock,
  Landmark,
  TrendingDown,
  TrendingUp,
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
  const { user } = useAuth()
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
  const max = Math.max(1, ...d.monthly.flatMap((m) => [Number(m.revenue), Number(m.expenses)]))

  return (
    <>
      <PageHeader title="Tableau de bord" description={user?.company?.name} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Écritures brouillon"
          value={d.draft_entries}
          hint="À valider"
          icon={<FileClock className="size-5" aria-hidden="true" />}
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
          label="Factures en retard"
          value={d.overdue_invoices}
          hint="Clients, échéance dépassée"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Produits et charges — 6 derniers mois">
          <div
            role="img"
            aria-label="Histogramme des produits et des charges par mois"
            className="flex h-48 items-end gap-3"
          >
            {d.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t-xs bg-brand-600"
                    style={{ height: `${(Number(m.revenue) / max) * 100}%` }}
                  />
                  <div
                    className="w-1/2 rounded-t-xs bg-warning"
                    style={{ height: `${(Number(m.expenses) / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-ink-muted">
                  {m.month.slice(5)}/{m.month.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-brand-600" aria-hidden="true" /> Produits
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-xs bg-warning" aria-hidden="true" /> Charges
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

        <Card title="Dernières écritures" padded={false}>
          {d.recent_entries.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Aucune écriture pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recent_entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
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
    </>
  )
}
