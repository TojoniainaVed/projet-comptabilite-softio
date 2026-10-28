import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { DatePicker } from '@/components/ui/DatePicker'
import { useListParams } from '@/hooks/useListParams'
import { paymentMethodLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { paymentsApi } from '@/features/payments/api'
import { formatDate, formatMoney } from '@/lib/utils'
import { invoiceBasePath } from '@/features/invoices/api'
import type { Payment } from '@/types/api'

export function PaymentsPage() {
  const list = useListParams()
  const query = paymentsApi.useList({ ...list.params, per_page: 25 })

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', cell: (p) => formatDate(p.paid_on) },
    {
      key: 'invoice',
      header: 'Facture',
      cell: (p) =>
        p.invoice ? (
          <Link
            className="text-brand-700 hover:underline"
            to={`${invoiceBasePath(p.invoice.type)}/${p.invoice.id}`}
          >
            {p.invoice.number ?? `#${p.invoice.id}`}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'sens',
      header: 'Sens',
      cell: (p) => (p.invoice?.type === 'supplier' ? 'Décaissement' : 'Encaissement'),
    },
    { key: 'method', header: 'Mode', cell: (p) => paymentMethodLabels[p.method] },
    {
      key: 'account',
      header: 'Compte',
      cell: (p) =>
        p.treasury_account ? `${p.treasury_account.code} — ${p.treasury_account.name}` : '—',
    },
    { key: 'ref', header: 'Référence', cell: (p) => p.reference ?? '—' },
    { key: 'amount', header: 'Montant', align: 'right', cell: (p) => formatMoney(p.amount) },
  ]

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Les paiements s'enregistrent depuis la facture concernée."
      />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-4">
          <DatePicker
            aria-label="Du"
            value={list.filters.from ?? ''}
            onChange={(e) => list.setFilter('from', e.target.value)}
          />
          <DatePicker
            aria-label="Au"
            value={list.filters.to ?? ''}
            onChange={(e) => list.setFilter('to', e.target.value)}
          />
        </div>
        <DataTable
          caption="Liste des paiements"
          columns={columns}
          rows={query.data?.data}
          rowKey={(p) => p.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun paiement"
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
