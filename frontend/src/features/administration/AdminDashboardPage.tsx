import {
  Activity,
  AlertTriangle,
  Building2,
  Info,
  MonitorSmartphone,
  UserCheck,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/feedback/States'
import { errorMessage } from '@/lib/form-errors'
import { formatDateTime } from '@/lib/utils'
import { useAdminDashboard } from '@/features/administration/api'

export function AdminDashboardPage() {
  const query = useAdminDashboard()

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError || !query.data)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
  const d = query.data
  const max = Math.max(1, ...d.logins_by_day.map((x) => x.count))

  return (
    <>
      <PageHeader
        title="Administration"
        description={
          d.scope === 'platform'
            ? 'Vue d’ensemble de la plateforme.'
            : 'Vue d’ensemble de votre entreprise.'
        }
      />

      {d.alerts.length > 0 && (
        <ul className="mb-6 space-y-2" aria-label="Alertes">
          {d.alerts.map((alert, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${alert.level === 'warning' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-info/30 bg-info/10 text-info'}`}
            >
              {alert.level === 'warning' ? (
                <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />
              ) : (
                <Info className="mt-0.5 size-4" aria-hidden="true" />
              )}
              {alert.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Utilisateurs"
          value={d.users_total}
          icon={<Users className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Utilisateurs actifs"
          value={d.users_active}
          icon={<UserCheck className="size-5" aria-hidden="true" />}
        />
        {d.companies_total !== null && (
          <StatCard
            label="Entreprises"
            value={d.companies_total}
            icon={<Building2 className="size-5" aria-hidden="true" />}
          />
        )}
        <StatCard
          label="Sessions actives"
          value={d.active_sessions}
          icon={<MonitorSmartphone className="size-5" aria-hidden="true" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Connexions — 7 derniers jours">
          <div
            role="img"
            aria-label="Histogramme des connexions par jour"
            className="flex h-40 items-end gap-2"
          >
            {d.logins_by_day.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="tabular text-xs text-ink-muted">{day.count}</span>
                <div
                  className="w-full rounded-t-xs bg-admin"
                  style={{ height: `${Math.max((day.count / max) * 100, 2)}%` }}
                />
                <span className="text-xs text-ink-muted">
                  {day.date.slice(8)}/{day.date.slice(5, 7)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Dernières connexions" padded={false}>
          {d.recent_logins.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Aucune connexion enregistrée.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recent_logins.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-ink-muted">{u.email}</p>
                  </div>
                  <time dateTime={u.last_login_at} className="shrink-0 text-xs text-ink-muted">
                    {formatDateTime(u.last_login_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activité récente" padded={false} className="lg:col-span-2">
          {d.recent_activity.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Aucune activité enregistrée.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recent_activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Activity className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">
                    {a.user ?? 'Système'}
                  </span>
                  <time dateTime={a.created_at} className="shrink-0 text-xs text-ink-muted">
                    {formatDateTime(a.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
