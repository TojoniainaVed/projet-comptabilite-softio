import { useState } from 'react'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FormField } from '@/components/ui/FormField'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { api } from '@/lib/api-client'
import { accountTypeLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { formatNumber, todayIso } from '@/lib/utils'
import { useBalanceSheet, useIncomeStatement, useTrialBalance } from '@/features/reports/api'
import type { ReportLine } from '@/types/api'

export function ReportsPage() {
  const [tab, setTab] = useState('trial')
  return (
    <>
      <PageHeader
        title="Rapports"
        description="Calculés en direct à partir des écritures validées. Ces états sont des aides de gestion, pas des états financiers certifiés."
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'trial', label: 'Balance générale', content: <TrialBalancePanel /> },
          { id: 'income', label: 'Compte de résultat', content: <IncomePanel /> },
          { id: 'balance', label: 'Bilan simplifié', content: <BalanceSheetPanel /> },
        ]}
      />
    </>
  )
}

function PeriodFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <FormField label="Du">
        {(c) => <DatePicker {...c} value={from} onChange={(e) => onFrom(e.target.value)} />}
      </FormField>
      <FormField label="Au">
        {(c) => <DatePicker {...c} value={to} onChange={(e) => onTo(e.target.value)} />}
      </FormField>
    </div>
  )
}

function TrialBalancePanel() {
  const { can } = useAuth()
  const toast = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = useTrialBalance({ from: from || undefined, to: to || undefined })

  const exportCsv = async () => {
    try {
      await api.download('/reports/trial-balance', 'balance-generale.csv', {
        format: 'csv',
        from,
        to,
      })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          {can('reports.export') && (
            <Button
              variant="secondary"
              icon={<Download className="size-4" aria-hidden="true" />}
              onClick={() => void exportCsv()}
            >
              Exporter (CSV)
            </Button>
          )}
        </div>
      </Card>
      <Card padded={false}>
        {query.isLoading ? (
          <LoadingSpinner />
        ) : query.isError || !query.data ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Balance générale</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2">
                    Compte
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Débit
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Crédit
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Solde débiteur
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Solde créditeur
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.account_id} className="border-b border-line">
                    <td className="px-4 py-2">
                      <span className="font-mono">{row.code}</span> {row.name}
                    </td>
                    <td className="px-4 py-2">{accountTypeLabels[row.type]}</td>
                    <td className="tabular px-4 py-2 text-right">{formatNumber(row.debit)}</td>
                    <td className="tabular px-4 py-2 text-right">{formatNumber(row.credit)}</td>
                    <td className="tabular px-4 py-2 text-right">
                      {formatNumber(row.balance_debit)}
                    </td>
                    <td className="tabular px-4 py-2 text-right">
                      {formatNumber(row.balance_credit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-canvas font-semibold">
                  <td colSpan={2} className="px-4 py-2">
                    Total{' '}
                    <Badge tone={query.data.totals.balanced === 'true' ? 'success' : 'danger'}>
                      {query.data.totals.balanced === 'true' ? 'Équilibrée' : 'Déséquilibrée'}
                    </Badge>
                  </td>
                  <td className="tabular px-4 py-2 text-right">
                    {formatNumber(query.data.totals.debit)}
                  </td>
                  <td className="tabular px-4 py-2 text-right">
                    {formatNumber(query.data.totals.credit)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Section({ title, lines, total }: { title: string; lines: ReportLine[]; total: string }) {
  return (
    <Card title={title} padded={false}>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-ink-muted">Aucun mouvement.</td>
            </tr>
          )}
          {lines.map((line) => (
            <tr key={line.account_id} className="border-b border-line">
              <td className="px-4 py-2">
                <span className="font-mono">{line.code}</span> {line.name}
              </td>
              <td className="tabular px-4 py-2 text-right">{formatNumber(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-canvas font-semibold">
            <td className="px-4 py-2">Total</td>
            <td className="tabular px-4 py-2 text-right">{formatNumber(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  )
}

function IncomePanel() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = useIncomeStatement({ from: from || undefined, to: to || undefined })

  return (
    <div className="space-y-4">
      <Card>
        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </Card>
      {query.isLoading ? (
        <LoadingSpinner />
      ) : query.isError || !query.data ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Produits" lines={query.data.income} total={query.data.total_income} />
            <Section
              title="Charges"
              lines={query.data.expenses}
              total={query.data.total_expenses}
            />
          </div>
          <Card>
            <p className="flex items-center justify-between text-base font-semibold">
              <span>Résultat net</span>
              <span className="tabular" data-testid="net-result">
                {formatNumber(query.data.net_result)}
              </span>
            </p>
          </Card>
        </>
      )}
    </div>
  )
}

function BalanceSheetPanel() {
  const [asOf, setAsOf] = useState(todayIso())
  const query = useBalanceSheet(asOf)

  return (
    <div className="space-y-4">
      <Card>
        <div className="sm:w-60">
          <FormField label="Arrêté au">
            {(c) => (
              <DatePicker
                {...c}
                value={asOf}
                onChange={(e) => e.target.value && setAsOf(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </Card>
      {query.isLoading ? (
        <LoadingSpinner />
      ) : query.isError || !query.data ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.balanced && (
            <InlineAlert>
              Le bilan n'est pas équilibré : vérifiez les écritures et les comptes de bilan.
            </InlineAlert>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Actif" lines={query.data.assets} total={query.data.total_assets} />
            <div className="space-y-4">
              <Section
                title="Passif"
                lines={query.data.liabilities}
                total={query.data.total_liabilities}
              />
              <Section
                title="Capitaux propres"
                lines={query.data.equity}
                total={query.data.total_equity}
              />
              <Card>
                <p className="text-sm text-ink-muted">
                  Résultat de la période non clôturé inclus dans les capitaux propres :{' '}
                  <span className="tabular font-medium text-ink">
                    {formatNumber(query.data.unclosed_result)}
                  </span>
                </p>
                <p className="mt-2 flex justify-between font-semibold">
                  <span>Total passif + capitaux propres</span>
                  <span className="tabular">
                    {formatNumber(query.data.total_liabilities_and_equity)}
                  </span>
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
