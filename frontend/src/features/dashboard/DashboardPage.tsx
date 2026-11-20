import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  registerables,
  ArcElement,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type TooltipItem,
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
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

type AnalysisTab = 'performance' | 'products' | 'result' | 'evolution'

const chartFont = {
  family: 'inherit',
  size: 11,
}

// -----------------------------------------------------------------------------
// Plugin : effet de profondeur 3D pour le graphique circulaire.
// Chart.js ne propose pas nativement les graphiques circulaires 3D.
// Cet effet dessine plusieurs couches assombries sous le graphique.
// -----------------------------------------------------------------------------

const pie3DPlugin: Plugin<'pie'> = {
  id: 'pie3D',

  beforeDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0)

    if (!meta || meta.data.length === 0) return

    const ctx = chart.ctx
    const arcs = meta.data as ArcElement[]
    const depth = 14

    ctx.save()

    for (let offset = depth; offset > 0; offset--) {
      arcs.forEach((arc) => {
        const properties = arc.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true)

        const x = properties.x
        const y = properties.y
        const outerRadius = properties.outerRadius
        const startAngle = properties.startAngle
        const endAngle = properties.endAngle

        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          typeof outerRadius !== 'number' ||
          typeof startAngle !== 'number' ||
          typeof endAngle !== 'number'
        ) {
          return
        }

        const backgroundColor = arc.options.backgroundColor

        if (typeof backgroundColor !== 'string') return

        ctx.beginPath()
        ctx.moveTo(x, y + offset)
        ctx.arc(x, y + offset, outerRadius, startAngle, endAngle)
        ctx.closePath()

        ctx.fillStyle = backgroundColor
        ctx.filter = 'brightness(0.68)'
        ctx.fill()
      })
    }

    ctx.filter = 'none'
    ctx.restore()
  },
}

ChartJS.register(...registerables, pie3DPlugin)

// -----------------------------------------------------------------------------
// Onglets de l'analyse financière
// -----------------------------------------------------------------------------

const analysisTabs: {
  id: AnalysisTab
  label: string
  icon: ReactNode
}[] = [
  {
    id: 'performance',
    label: "Vue d'ensemble",
    icon: <BarChart3 className="size-4" />,
  },
  {
    id: 'products',
    label: 'Produits / Charges',
    icon: <ListTree className="size-4" />,
  },
  {
    id: 'result',
    label: 'Résultat',
    icon: <TrendingUp className="size-4" />,
  },
  {
    id: 'evolution',
    label: 'Évolution',
    icon: <CalendarDays className="size-4" />,
  },
]

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

function getResultStatus(value: number) {
  if (value > 0) {
    return {
      label: 'Bénéfice',
      color: 'text-success',
      background: 'bg-success/10',
      icon: <TrendingUp className="size-5" />,
    }
  }

  if (value < 0) {
    return {
      label: 'Perte',
      color: 'text-danger',
      background: 'bg-danger/10',
      icon: <TrendingDown className="size-5" />,
    }
  }

  return {
    label: 'Équilibre',
    color: 'text-ink-muted',
    background: 'bg-surface-secondary',
    icon: <CheckCircle2 className="size-5" />,
  }
}

function getMonthLabel(month: string) {
  return `${month.slice(5)}/${month.slice(2, 4)}`
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function DashboardPage() {
  const { user, can } = useAuth()
  const currency = user?.company?.currency ?? 'MGA'

  const [activeTab, setActiveTab] = useState<AnalysisTab>('performance')

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) =>
      api.get<{ data: AccountingDashboard }>('/dashboard', undefined, signal),
    select: (response) => response.data,
  })

  if (query.isLoading) {
    return <LoadingSpinner />
  }

  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
  }

  const d = query.data

  // ---------------------------------------------------------------------------
  // Accès rapides : affichés selon les permissions de l'utilisateur connecté.
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Données du tableau de bord
  // ---------------------------------------------------------------------------

  const monthly = d.monthly ?? []

  const currentResult = Number(d.net_result_this_month)
  const resultStatus = getResultStatus(currentResult)

  const labels = monthly.map((item) => getMonthLabel(item.month))
  const revenues = monthly.map((item) => Number(item.revenue))
  const expenses = monthly.map((item) => Number(item.expenses))

  const results = monthly.map((item) => Number(item.revenue) - Number(item.expenses))

  const overdueTotal = d.overdue_customer_invoices + d.overdue_supplier_invoices

  const pendingTotal = overdueTotal + d.draft_entries

  // ---------------------------------------------------------------------------
  // Options communes des graphiques
  // ---------------------------------------------------------------------------

  const commonPlugins = {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle' as const,
        padding: 18,
        font: chartFont,
      },
    },
    tooltip: {
      backgroundColor: '#172033',
      padding: 12,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
    },
  }

  const commonScales = {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: chartFont,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: '#E9EEF5',
      },
      ticks: {
        font: chartFont,
        callback: (value: string | number) => formatNumber(Number(value)),
      },
    },
  }

  // ---------------------------------------------------------------------------
  // 1. Vue d'ensemble : barres groupées + ligne du résultat
  // ---------------------------------------------------------------------------

  const overviewData = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Produits',
        data: revenues,
        backgroundColor: '#2563EB',
        borderRadius: 5,
        maxBarThickness: 30,
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Charges',
        data: expenses,
        backgroundColor: '#F59E0B',
        borderRadius: 5,
        maxBarThickness: 30,
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Résultat',
        data: results,
        borderColor: '#0D9488',
        backgroundColor: '#0D9488',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: false,
        order: 1,
      },
    ],
  } as unknown as ChartData<'bar'>

  const overviewOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      ...commonPlugins,
      tooltip: {
        ...commonPlugins.tooltip,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const value = context.parsed.y ?? 0
            const label = context.dataset.label ?? ''

            return `${label} : ${formatMoney(value, currency)}`
          },
        },
      },
    },
    scales: commonScales,
  }

  // ---------------------------------------------------------------------------
  // 2. Produits / Charges : graphique circulaire avec effet 3D
  // ---------------------------------------------------------------------------

  const revenueThisMonth = Number(d.revenue_this_month)
  const expensesThisMonth = Number(d.expenses_this_month)

  const pieData = {
    labels: ['Produits', 'Charges'],
    datasets: [
      {
        data: [revenueThisMonth, expensesThisMonth],
        backgroundColor: ['#2563EB', '#F59E0B'],
        borderColor: ['#FFFFFF', '#FFFFFF'],
        borderWidth: 3,
        hoverOffset: 12,
      },
    ],
  }

  const pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
    },
    plugins: {
      ...commonPlugins,
      tooltip: {
        ...commonPlugins.tooltip,
        callbacks: {
          label: (context: TooltipItem<'pie'>) => {
            const value = context.parsed
            const label = context.label ?? ''

            return `${label} : ${formatMoney(value, currency)}`
          },
        },
      },
    },
  }

  // ---------------------------------------------------------------------------
  // 3. Résultat : histogramme des bénéfices et des pertes
  // ---------------------------------------------------------------------------

  const resultData = {
    labels,
    datasets: [
      {
        label: 'Résultat mensuel',
        data: results,
        backgroundColor: results.map((value) => (value >= 0 ? '#10B981' : '#EF4444')),
        borderRadius: 6,
        maxBarThickness: 42,
      },
    ],
  }

  const resultOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
    },
    plugins: {
      ...commonPlugins,
      tooltip: {
        ...commonPlugins.tooltip,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const value = context.parsed.y ?? 0

            return `Résultat : ${formatMoney(value, currency)}`
          },
        },
      },
    },
    scales: {
      x: commonScales.x,
      y: {
        grid: {
          color: '#E9EEF5',
        },
        ticks: {
          font: chartFont,
          callback: (value: string | number) => formatNumber(Number(value)),
        },
      },
    },
  }

  // ---------------------------------------------------------------------------
  // 4. Évolution : graphique en ligne des produits et des charges
  // ---------------------------------------------------------------------------

  const evolutionData = {
    labels,
    datasets: [
      {
        label: 'Produits',
        data: revenues,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.10)',
        pointBackgroundColor: '#2563EB',
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Charges',
        data: expenses,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.10)',
        pointBackgroundColor: '#F59E0B',
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: 0.35,
        fill: false,
      },
    ],
  }

  const evolutionOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700,
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      ...commonPlugins,
      tooltip: {
        ...commonPlugins.tooltip,
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y ?? 0
            const label = context.dataset.label ?? ''

            return `${label} : ${formatMoney(value, currency)}`
          },
        },
      },
    },
    scales: commonScales,
  }

  // ---------------------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Tableau de bord" description={user?.company?.name} />

      {/* Situation financière */}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Situation financière</p>
          <p className="text-xs text-ink-muted">Vue générale de votre entreprise</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
          <CalendarDays className="size-4" />
          Mois en cours
        </div>
      </div>

      {/* Indicateurs principaux */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trésorerie"
          value={formatMoney(d.treasury_total, currency)}
          icon={<Landmark className="size-5 text-brand-700" aria-hidden="true" />}
        />

        <StatCard
          label="Créances clients"
          value={formatMoney(d.receivable_outstanding, currency)}
          hint="Factures validées non soldées"
          icon={<ArrowDownCircle className="size-5 text-info" aria-hidden="true" />}
        />

        <StatCard
          label="Dettes fournisseurs"
          value={formatMoney(d.payable_outstanding, currency)}
          hint="Factures validées non soldées"
          icon={<ArrowUpCircle className="size-5 text-warning" aria-hidden="true" />}
        />

        <div className="rounded-card border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-muted">Résultat du mois</p>
            <span className={resultStatus.color}>{resultStatus.icon}</span>
          </div>

          <p className="tabular mt-1.5 text-xl font-semibold text-ink">
            {formatMoney(d.net_result_this_month, currency)}
          </p>

          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${resultStatus.background} ${resultStatus.color}`}
            >
              {resultStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* Analyse financière */}

      <Card
        title="Analyse financière"
        actions={
          <span className="hidden text-xs text-ink-muted sm:inline">
            Analyse des six derniers mois
          </span>
        }
      >
        {/* Navigation des analyses */}

        <div
          role="tablist"
          aria-label="Analyses financières"
          className="-mx-4 flex overflow-x-auto border-b border-line px-4"
        >
          {analysisTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-transparent text-ink-muted hover:bg-surface-secondary hover:text-ink'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {/* 1. Vue d'ensemble */}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-ink">Performance financière</h3>
                <p className="text-xs text-ink-muted">
                  Produits et charges en barres, résultat en ligne
                </p>
              </div>

              {monthly.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-muted">
                  Aucune donnée mensuelle disponible.
                </p>
              ) : (
                <div className="h-[340px] w-full">
                  <Bar data={overviewData} options={overviewOptions} />
                </div>
              )}
            </div>
          )}

          {/* 2. Produits / Charges */}

          {activeTab === 'products' && (
            <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Répartition des produits et des charges
                </h3>
                <p className="text-xs text-ink-muted">Répartition financière du mois en cours</p>

                {revenueThisMonth + expensesThisMonth === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-muted">
                    Aucune donnée disponible pour cette période.
                  </p>
                ) : (
                  <div className="mx-auto mt-4 h-[320px] max-w-[520px]">
                    <Pie data={pieData} options={pieOptions} />
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-line bg-surface-secondary p-5">
                <h3 className="text-sm font-semibold text-ink">Détail du mois</h3>

                <div className="flex items-start gap-3">
                  <span className="mt-1 size-3 shrink-0 rounded-full bg-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">Produits</p>
                    <p className="break-words text-base font-bold text-ink">
                      {formatMoney(d.revenue_this_month, currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 size-3 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">Charges</p>
                    <p className="break-words text-base font-bold text-ink">
                      {formatMoney(d.expenses_this_month, currency)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-xs text-ink-muted">Résultat du mois</p>
                  <p className={`mt-1 break-words text-lg font-bold ${resultStatus.color}`}>
                    {formatMoney(d.net_result_this_month, currency)}
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resultStatus.background} ${resultStatus.color}`}
                  >
                    {resultStatus.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Résultat */}

          {activeTab === 'result' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-ink-muted">Résultat financier du mois</p>
                  <p className="mt-1 text-2xl font-bold text-ink">
                    {formatMoney(d.net_result_this_month, currency)}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${resultStatus.background} ${resultStatus.color}`}
                >
                  {resultStatus.icon}
                  {resultStatus.label}
                </span>
              </div>

              <div>
                <h3 className="text-base font-semibold text-ink">Résultat par mois</h3>
                <p className="text-xs text-ink-muted">
                  Bénéfices et pertes calculés à partir des produits moins les charges
                </p>
              </div>

              {monthly.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-muted">
                  Aucune donnée mensuelle disponible.
                </p>
              ) : (
                <div className="h-[320px] w-full">
                  <Bar data={resultData} options={resultOptions} />
                </div>
              )}
            </div>
          )}

          {/* 4. Évolution */}

          {activeTab === 'evolution' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-ink">Évolution financière</h3>
                <p className="text-xs text-ink-muted">
                  Évolution des produits et des charges sur les six derniers mois
                </p>
              </div>

              {monthly.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-muted">
                  Aucune donnée mensuelle disponible.
                </p>
              ) : (
                <div className="h-[340px] w-full">
                  <Line data={evolutionData} options={evolutionOptions} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tableau accessible des données mensuelles */}

        <table className="sr-only">
          <caption>Produits, charges et résultats par mois</caption>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Produits</th>
              <th scope="col">Charges</th>
              <th scope="col">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((item) => (
              <tr key={item.month}>
                <th scope="row">{item.month}</th>
                <td>{formatNumber(item.revenue)}</td>
                <td>{formatNumber(item.expenses)}</td>
                <td>{formatNumber(Number(item.revenue) - Number(item.expenses))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Opérations à traiter et activités récentes */}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2">
              Opérations à traiter
              {pendingTotal > 0 && (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                  {pendingTotal}
                </span>
              )}
            </span>
          }
          actions={<span className="text-xs text-ink-muted">Éléments en attente</span>}
          padded={false}
        >
          <div className="divide-y divide-line">
            <Link
              to="/sales/invoices"
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <AlertTriangle className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">
                    Factures clients en retard
                  </span>
                  <span className="block text-xs text-ink-muted">Factures échues et impayées</span>
                </span>
              </span>

              <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                {d.overdue_customer_invoices}
              </span>
            </Link>

            <Link
              to="/purchases/invoices"
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <Truck className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">
                    Factures fournisseurs à payer
                  </span>
                  <span className="block text-xs text-ink-muted">Factures échues et impayées</span>
                </span>
              </span>

              <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                {d.overdue_supplier_invoices}
              </span>
            </Link>

            <Link
              to="/journal-entries"
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <FileClock className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">Écritures en brouillon</span>
                  <span className="block text-xs text-ink-muted">
                    Écritures à vérifier et valider
                  </span>
                </span>
              </span>

              <span className="rounded-full bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">
                {d.draft_entries}
              </span>
            </Link>
          </div>
        </Card>

        <Card title="Activités récentes" padded={false}>
          {d.recent_entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Aucune écriture pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recent_entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <FileText className="size-5" />
                    </span>

                    <div className="min-w-0">
                      <Link
                        to={`/journal-entries/${entry.id}`}
                        className="block truncate font-medium text-brand-700 hover:underline"
                      >
                        {entry.reference ?? 'Brouillon'}
                      </Link>

                      <p className="truncate text-xs text-ink-muted">
                        {entry.description} · {formatDate(entry.entry_date)}
                      </p>
                    </div>
                  </div>

                  <EntryStatusBadge status={entry.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
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
    </div>
  )
}
