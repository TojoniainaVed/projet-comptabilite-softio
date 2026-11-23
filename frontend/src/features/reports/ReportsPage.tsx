import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Download,
  Printer,
  RotateCcw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { accountsApi } from '@/features/accounts/api'
import {
  useBalanceSheet,
  useGeneralLedger,
  useIncomeStatement,
  useTrialBalance,
} from '@/features/reports/api'
import {
  accountClassLabel,
  periodPresetLabels,
  presetRange,
  type PeriodPreset,
} from '@/features/reports/periods'
import { api } from '@/lib/api-client'
import { accountTypeLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { cn, formatDate, formatNumber, toCents, todayIso } from '@/lib/utils'
import type { ReportLine, TrialBalanceReport } from '@/types/api'

import './reports.css'

type ReportTab = 'trial' | 'ledger' | 'income' | 'balance'

const reportTitles: Record<ReportTab, string> = {
  trial: 'Balance générale',
  ledger: 'Grand livre',
  income: 'Compte de résultat',
  balance: 'Bilan simplifié',
}

/** Somme exacte de montants décimaux (en centimes entiers), renvoyée sous forme décimale. */
function sumAmounts(values: string[]): number {
  return values.reduce((total, value) => total + toCents(value), 0) / 100
}

export function ReportsPage() {
  const { can } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<ReportTab>('trial')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [asOf, setAsOf] = useState(todayIso())
  const [accountId, setAccountId] = useState('')

  const period = { from, to }
  const setPeriod = (next: { from: string; to: string }) => {
    setFrom(next.from)
    setTo(next.to)
  }

  // Export CSV de l'état affiché (le serveur vérifie le droit d'export et journalise l'opération).
  const exportCsv = async () => {
    try {
      switch (tab) {
        case 'trial':
          await api.download('/reports/trial-balance', 'balance-generale.csv', {
            format: 'csv',
            from,
            to,
          })
          break
        case 'income':
          await api.download('/reports/income-statement', 'compte-de-resultat.csv', {
            format: 'csv',
            from,
            to,
          })
          break
        case 'balance':
          await api.download('/reports/balance-sheet', 'bilan-simplifie.csv', {
            format: 'csv',
            as_of: asOf,
          })
          break
        case 'ledger':
          if (!accountId) {
            toast.error('Sélectionnez d’abord un compte.')
            return
          }
          await api.download('/reports/general-ledger', 'grand-livre.csv', {
            format: 'csv',
            account_id: accountId,
            from,
            to,
          })
          break
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Rapports"
        description="Analysez la situation comptable de l'entreprise à partir des écritures validées."
        actions={
          <>
            {can('reports.export') && (
              <Button
                variant="secondary"
                icon={<Download className="size-4" aria-hidden="true" />}
                onClick={() => void exportCsv()}
              >
                Exporter (CSV)
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Printer className="size-4" aria-hidden="true" />}
              onClick={() => window.print()}
            >
              Imprimer
            </Button>
          </>
        }
      />

      <Card padded={false} className="mb-5 print:hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <BarChart3 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Analyse financière</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Balance, grand livre, compte de résultat et bilan sont calculés en direct. Ces états
              sont des aides de gestion, pas des états financiers certifiés. La trésorerie se
              consulte dans{' '}
              <Link to="/treasury" className="font-medium text-brand-700 hover:underline">
                Trésorerie
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as ReportTab)}
        tabs={[
          {
            id: 'trial',
            label: reportTitles.trial,
            content: <TrialBalancePanel period={period} onPeriod={setPeriod} />,
          },
          {
            id: 'ledger',
            label: reportTitles.ledger,
            content: (
              <LedgerPanel
                period={period}
                onPeriod={setPeriod}
                accountId={accountId}
                onAccount={setAccountId}
              />
            ),
          },
          {
            id: 'income',
            label: reportTitles.income,
            content: <IncomePanel period={period} onPeriod={setPeriod} />,
          },
          {
            id: 'balance',
            label: reportTitles.balance,
            content: <BalancePanel asOf={asOf} onAsOf={setAsOf} />,
          },
        ]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Éléments communs                                                    */
/* ------------------------------------------------------------------ */

interface PeriodValue {
  from: string
  to: string
}

/** Carte « Filtres et période » : dates, périodes rapides et réinitialisation. */
function FiltersCard({
  period,
  onPeriod,
  children,
}: {
  period?: PeriodValue
  onPeriod?: (period: PeriodValue) => void
  children?: ReactNode
}) {
  return (
    <Card
      title="Filtres et période"
      padded={false}
      className="mb-5 print:hidden"
      actions={
        period && onPeriod ? (
          <button
            type="button"
            onClick={() => onPeriod({ from: '', to: '' })}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Réinitialiser les dates
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 p-4">
        {period && onPeriod && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DateField
                id="report-from"
                label="Date de début"
                value={period.from}
                onChange={(from) => onPeriod({ ...period, from })}
              />
              <DateField
                id="report-to"
                label="Date de fin"
                value={period.to}
                onChange={(to) => onPeriod({ ...period, to })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Périodes rapides :</span>
              {(Object.keys(periodPresetLabels) as PeriodPreset[]).map((preset) => {
                const range = presetRange(preset)
                const active = period.from === range.from && period.to === range.to
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPeriod(range)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-line bg-surface text-ink-muted hover:bg-canvas hover:text-ink',
                    )}
                  >
                    {periodPresetLabels[preset]}
                  </button>
                )
              })}
            </div>
          </>
        )}
        {children}
      </div>
    </Card>
  )
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <DatePicker
          id={id}
          className="pl-9"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}

/** Zone imprimée : titre et période affichés uniquement sur papier. */
function ReportSheet({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="report-print-area space-y-5">
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">Softio Comptabilité · {title}</h1>
        <p className="text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function periodSubtitle(from: string, to: string): string {
  if (from && to) return `Du ${formatDate(from)} au ${formatDate(to)}`
  if (from) return `À partir du ${formatDate(from)}`
  if (to) return `Jusqu'au ${formatDate(to)}`
  return 'Toutes périodes'
}

function StatRow({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

const thClass = 'px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-muted uppercase'

/* ------------------------------------------------------------------ */
/* Balance générale                                                    */
/* ------------------------------------------------------------------ */

type TrialRow = TrialBalanceReport['rows'][number]

function TrialBalancePanel({
  period,
  onPeriod,
}: {
  period: PeriodValue
  onPeriod: (period: PeriodValue) => void
}) {
  const query = useTrialBalance({ from: period.from || undefined, to: period.to || undefined })
  const [search, setSearch] = useState('')
  const [hideZero, setHideZero] = useState(false)

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (query.data?.rows ?? []).filter((row) => {
      if (hideZero && toCents(row.balance_debit) === 0 && toCents(row.balance_credit) === 0) {
        return false
      }
      return !needle || `${row.code} ${row.name}`.toLowerCase().includes(needle)
    })
  }, [query.data, search, hideZero])

  // Regroupement par classe du plan comptable, avec sous-totaux.
  const groups = useMemo(() => {
    const map = new Map<string, TrialRow[]>()
    for (const row of rows) {
      const label = accountClassLabel(row.code)
      map.set(label, [...(map.get(label) ?? []), row])
    }
    return [...map.entries()]
  }, [rows])

  const totals = query.data?.totals
  const balanced = totals?.balanced === 'true'

  return (
    <>
      <StatRow>
        <StatCard
          label="Total débit"
          value={totals ? formatNumber(totals.debit) : '—'}
          hint="Mouvements débiteurs de la période"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Total crédit"
          value={totals ? formatNumber(totals.credit) : '—'}
          hint="Mouvements créditeurs de la période"
          icon={<TrendingDown className="size-5" />}
        />
        <StatCard
          label="Comptes mouvementés"
          value={query.data ? query.data.rows.length.toLocaleString('fr-FR') : '—'}
          hint="Comptes ayant au moins une écriture"
          icon={<BookOpen className="size-5" />}
        />
        <StatCard
          label="Équilibre"
          value={
            totals ? (
              <Badge tone={balanced ? 'success' : 'danger'}>
                {balanced ? 'Équilibrée' : 'Déséquilibrée'}
              </Badge>
            ) : (
              '—'
            )
          }
          hint="Total débit = total crédit"
          icon={<Scale className="size-5" />}
        />
      </StatRow>

      <FiltersCard period={period} onPeriod={onPeriod}>
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un compte (code ou intitulé)…"
            label="Rechercher un compte"
          />
          <Checkbox
            label="Masquer les comptes soldés à zéro"
            checked={hideZero}
            onChange={(event) => setHideZero(event.target.checked)}
          />
        </div>
      </FiltersCard>

      <ReportSheet title="Balance générale" subtitle={periodSubtitle(period.from, period.to)}>
        <Card
          title="Balance générale"
          padded={false}
          actions={
            <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">
              {query.data ? `${rows.length} compte(s)` : 'Chargement...'}
            </span>
          }
        >
          {query.isLoading ? (
            <LoadingSpinner />
          ) : query.isError || !query.data ? (
            <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun compte à afficher"
              description="Aucune écriture validée ne correspond à ces critères."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <caption className="sr-only">Balance générale</caption>
                <thead>
                  <tr className="border-b border-line bg-canvas text-left">
                    <th scope="col" className={thClass}>
                      Compte
                    </th>
                    <th scope="col" className={thClass}>
                      Type
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Débit
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Crédit
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Solde débiteur
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Solde créditeur
                    </th>
                  </tr>
                </thead>
                {groups.map(([label, groupRows]) => (
                  <tbody key={label}>
                    <tr className="border-b border-line bg-brand-50/60 font-semibold text-brand-800">
                      <td colSpan={2} className="px-4 py-2">
                        {label}
                      </td>
                      <td className="tabular px-4 py-2 text-right">
                        {formatNumber(sumAmounts(groupRows.map((r) => r.debit)))}
                      </td>
                      <td className="tabular px-4 py-2 text-right">
                        {formatNumber(sumAmounts(groupRows.map((r) => r.credit)))}
                      </td>
                      <td className="tabular px-4 py-2 text-right">
                        {formatNumber(sumAmounts(groupRows.map((r) => r.balance_debit)))}
                      </td>
                      <td className="tabular px-4 py-2 text-right">
                        {formatNumber(sumAmounts(groupRows.map((r) => r.balance_credit)))}
                      </td>
                    </tr>
                    {groupRows.map((row) => (
                      <tr key={row.account_id} className="border-b border-line hover:bg-canvas">
                        <td className="px-4 py-2.5 pl-8">
                          <span className="font-mono text-ink-muted">{row.code}</span>{' '}
                          <span className="font-medium">{row.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {accountTypeLabels[row.type]}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {formatNumber(row.debit)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {formatNumber(row.credit)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {formatNumber(row.balance_debit)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {formatNumber(row.balance_credit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="bg-canvas font-semibold">
                    <td colSpan={2} className="px-4 py-3">
                      Total général{' '}
                      <Badge tone={balanced ? 'success' : 'danger'}>
                        {balanced ? 'Équilibrée' : 'Déséquilibrée'}
                      </Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatNumber(query.data.totals.debit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatNumber(query.data.totals.credit)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </ReportSheet>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Grand livre                                                         */
/* ------------------------------------------------------------------ */

function LedgerPanel({
  period,
  onPeriod,
  accountId,
  onAccount,
}: {
  period: PeriodValue
  onPeriod: (period: PeriodValue) => void
  accountId: string
  onAccount: (id: string) => void
}) {
  const accounts = accountsApi.useOptions({ is_active: 1 })
  const query = useGeneralLedger(accountId, {
    from: period.from || undefined,
    to: period.to || undefined,
  })

  const selectable = (accounts.data ?? []).filter((account) => !account.is_group)
  const ledger = query.data

  return (
    <>
      <StatRow>
        <StatCard
          label="Solde d'ouverture"
          value={ledger ? formatNumber(ledger.opening_balance) : '—'}
          hint="Solde avant la date de début"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Total débit"
          value={ledger ? formatNumber(ledger.totals.debit) : '—'}
          hint="Mouvements de la période"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Total crédit"
          value={ledger ? formatNumber(ledger.totals.credit) : '—'}
          hint="Mouvements de la période"
          icon={<TrendingDown className="size-5" />}
        />
        <StatCard
          label="Solde de clôture"
          value={ledger ? formatNumber(ledger.totals.closing_balance) : '—'}
          hint="Débit positif, crédit négatif"
          icon={<Scale className="size-5" />}
        />
      </StatRow>

      <FiltersCard period={period} onPeriod={onPeriod}>
        <div className="space-y-1.5 border-t border-line pt-4 sm:max-w-md">
          <label htmlFor="ledger-account" className="text-xs font-medium text-ink-muted">
            Compte
          </label>
          <Select
            id="ledger-account"
            value={accountId}
            onChange={(event) => onAccount(event.target.value)}
          >
            <option value="">Sélectionnez un compte…</option>
            {selectable.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </Select>
        </div>
      </FiltersCard>

      <ReportSheet
        title={
          ledger ? `Grand livre · ${ledger.account.code} ${ledger.account.name}` : 'Grand livre'
        }
        subtitle={periodSubtitle(period.from, period.to)}
      >
        <Card
          title={ledger ? `${ledger.account.code} · ${ledger.account.name}` : 'Grand livre'}
          padded={false}
          actions={
            ledger && (
              <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">
                {ledger.lines.length} écriture(s)
              </span>
            )
          }
        >
          {accountId === '' ? (
            <EmptyState
              title="Aucun compte sélectionné"
              description="Choisissez un compte pour afficher tous ses mouvements avec le solde progressif."
            />
          ) : query.isLoading ? (
            <LoadingSpinner />
          ) : query.isError || !ledger ? (
            <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <caption className="sr-only">Grand livre du compte {ledger.account.code}</caption>
                <thead>
                  <tr className="border-b border-line bg-canvas text-left">
                    <th scope="col" className={thClass}>
                      Date
                    </th>
                    <th scope="col" className={thClass}>
                      Pièce
                    </th>
                    <th scope="col" className={thClass}>
                      Libellé
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Débit
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Crédit
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Solde
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line bg-brand-50/60 font-semibold text-brand-800">
                    <td colSpan={5} className="px-4 py-2">
                      Solde d'ouverture
                    </td>
                    <td className="tabular px-4 py-2 text-right">
                      {formatNumber(ledger.opening_balance)}
                    </td>
                  </tr>
                  {ledger.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                        Aucun mouvement sur cette période.
                      </td>
                    </tr>
                  )}
                  {ledger.lines.map((line, index) => (
                    <tr
                      key={`${line.entry_id}-${index}`}
                      className="border-b border-line hover:bg-canvas"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(line.date)}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/journal-entries/${line.entry_id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {line.reference ?? `#${line.entry_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{line.label || '—'}</td>
                      <td className="tabular px-4 py-2.5 text-right">
                        {toCents(line.debit) ? formatNumber(line.debit) : ''}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right">
                        {toCents(line.credit) ? formatNumber(line.credit) : ''}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right font-medium">
                        {formatNumber(line.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-canvas font-semibold">
                    <td colSpan={3} className="px-4 py-3">
                      Total de la période
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatNumber(ledger.totals.debit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatNumber(ledger.totals.credit)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatNumber(ledger.totals.closing_balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </ReportSheet>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Compte de résultat et bilan                                         */
/* ------------------------------------------------------------------ */

function Section({
  title,
  lines,
  total,
  showShare = false,
}: {
  title: string
  lines: ReportLine[]
  total: string
  showShare?: boolean
}) {
  const totalCents = toCents(total)

  return (
    <Card title={title} padded={false}>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-ink-muted">Aucun mouvement.</td>
            </tr>
          )}
          {lines.map((line) => (
            <tr key={line.account_id} className="border-b border-line hover:bg-canvas">
              <td className="px-4 py-2.5">
                <span className="font-mono text-ink-muted">{line.code}</span>{' '}
                <span className="font-medium">{line.name}</span>
              </td>
              {showShare && (
                <td className="tabular px-4 py-2.5 text-right text-xs text-ink-muted">
                  {totalCents !== 0
                    ? `${((toCents(line.amount) / totalCents) * 100).toLocaleString('fr-FR', {
                        maximumFractionDigits: 1,
                      })} %`
                    : '—'}
                </td>
              )}
              <td className="tabular px-4 py-2.5 text-right">{formatNumber(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-canvas font-semibold">
            <td className="px-4 py-3" colSpan={showShare ? 2 : 1}>
              Total {title.toLowerCase()}
            </td>
            <td className="tabular px-4 py-3 text-right">{formatNumber(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  )
}

function IncomePanel({
  period,
  onPeriod,
}: {
  period: PeriodValue
  onPeriod: (period: PeriodValue) => void
}) {
  const query = useIncomeStatement({ from: period.from || undefined, to: period.to || undefined })
  const data = query.data

  const net = data ? toCents(data.net_result) : 0
  const incomeCents = data ? toCents(data.total_income) : 0
  const margin =
    data && incomeCents !== 0
      ? `${((net / incomeCents) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
      : '—'

  return (
    <>
      <StatRow>
        <StatCard
          label="Produits"
          value={data ? formatNumber(data.total_income) : '—'}
          hint="Total des produits de la période"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Charges"
          value={data ? formatNumber(data.total_expenses) : '—'}
          hint="Total des charges de la période"
          icon={<TrendingDown className="size-5" />}
        />
        <StatCard
          label="Résultat net"
          value={
            data ? (
              <span className={net < 0 ? 'text-danger' : 'text-success'}>
                {net < 0 ? 'Perte · ' : 'Bénéfice · '}
                {formatNumber(data.net_result)}
              </span>
            ) : (
              '—'
            )
          }
          hint="Produits − charges"
          icon={<Scale className="size-5" />}
        />
        <StatCard
          label="Marge nette"
          value={margin}
          hint="Résultat net ÷ produits"
          icon={<BarChart3 className="size-5" />}
        />
      </StatRow>

      <FiltersCard period={period} onPeriod={onPeriod} />

      <ReportSheet title="Compte de résultat" subtitle={periodSubtitle(period.from, period.to)}>
        {query.isLoading ? (
          <LoadingSpinner />
        ) : query.isError || !data ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Produits" lines={data.income} total={data.total_income} showShare />
              <Section
                title="Charges"
                lines={data.expenses}
                total={data.total_expenses}
                showShare
              />
            </div>
            <Card>
              <p className="flex items-center justify-between text-base font-semibold">
                <span>Résultat net</span>
                <span className="tabular" data-testid="net-result">
                  {formatNumber(data.net_result)}
                </span>
              </p>
            </Card>
          </>
        )}
      </ReportSheet>
    </>
  )
}

function BalancePanel({ asOf, onAsOf }: { asOf: string; onAsOf: (value: string) => void }) {
  const query = useBalanceSheet(asOf)
  const data = query.data

  return (
    <>
      <StatRow>
        <StatCard
          label="Total actif"
          value={data ? formatNumber(data.total_assets) : '—'}
          hint="Ce que possède l'entreprise"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Passif + capitaux propres"
          value={data ? formatNumber(data.total_liabilities_and_equity) : '—'}
          hint="Dettes et fonds propres"
          icon={<TrendingDown className="size-5" />}
        />
        <StatCard
          label="Résultat non clôturé"
          value={data ? formatNumber(data.unclosed_result) : '—'}
          hint="Inclus dans les capitaux propres"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Équilibre"
          value={
            data ? (
              <Badge tone={data.balanced ? 'success' : 'danger'}>
                {data.balanced ? 'Équilibré' : 'Déséquilibré'}
              </Badge>
            ) : (
              '—'
            )
          }
          hint="Actif = passif + capitaux propres"
          icon={<Scale className="size-5" />}
        />
      </StatRow>

      <Card title="Date d'arrêté" padded={false} className="mb-5 print:hidden">
        <div className="p-4 sm:w-72">
          <DateField
            id="report-as-of"
            label="Arrêté au"
            value={asOf}
            onChange={(value) => value && onAsOf(value)}
          />
        </div>
      </Card>

      <ReportSheet title="Bilan simplifié" subtitle={`Arrêté au ${formatDate(asOf)}`}>
        {query.isLoading ? (
          <LoadingSpinner />
        ) : query.isError || !data ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <>
            {!data.balanced && (
              <InlineAlert>
                Le bilan n'est pas équilibré : vérifiez les écritures et les comptes de bilan.
              </InlineAlert>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Actif" lines={data.assets} total={data.total_assets} />
              <div className="space-y-4">
                <Section title="Passif" lines={data.liabilities} total={data.total_liabilities} />
                <Section title="Capitaux propres" lines={data.equity} total={data.total_equity} />
                <Card>
                  <p className="text-sm text-ink-muted">
                    Résultat de la période non clôturé inclus dans les capitaux propres :{' '}
                    <span className="tabular font-medium text-ink">
                      {formatNumber(data.unclosed_result)}
                    </span>
                  </p>
                  <p className="mt-2 flex justify-between font-semibold">
                    <span>Total passif + capitaux propres</span>
                    <span className="tabular">
                      {formatNumber(data.total_liabilities_and_equity)}
                    </span>
                  </p>
                </Card>
              </div>
            </div>
          </>
        )}
      </ReportSheet>
    </>
  )
}
