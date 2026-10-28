import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { accountCategoryLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { formatMoney } from '@/lib/utils'
import { useTreasury } from '@/features/reports/api'
import type { AccountCategory, TreasuryReport } from '@/types/api'

export function TreasuryPage() {
  const query = useTreasury()
  const columns: Column<TreasuryReport['accounts'][number]>[] = [
    { key: 'code', header: 'Compte', cell: (a) => <span className="font-mono">{a.code}</span> },
    { key: 'name', header: 'Intitulé', cell: (a) => a.name },
    {
      key: 'cat',
      header: 'Nature',
      cell: (a) => accountCategoryLabels[a.category as AccountCategory] ?? a.category,
    },
    { key: 'balance', header: 'Solde', align: 'right', cell: (a) => formatMoney(a.balance) },
  ]

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description="Soldes des comptes de banque et de caisse, d'après les écritures validées."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Trésorerie totale"
          value={query.data ? formatMoney(query.data.total) : '—'}
        />
      </div>
      <Card padded={false}>
        <DataTable
          caption="Soldes de trésorerie"
          columns={columns}
          rows={query.data?.accounts}
          rowKey={(a) => a.account_id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun compte de trésorerie"
          emptyDescription="Déclarez un compte avec le rôle « Banque » ou « Caisse » dans le plan comptable."
        />
      </Card>
    </>
  )
}
