import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { InvoiceStatusBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney } from '@/lib/utils'
import { invoiceBasePath, invoicesApi, useInvoiceActions } from '@/features/invoices/api'
import type { Invoice, InvoiceType } from '@/types/api'

export function InvoicesPage({ kind }: { kind: InvoiceType }) {
  const isCustomer = kind === 'customer'
  const { can } = useAuth()
  const navigate = useNavigate()
  const list = useListParams()
  const query = invoicesApi.useList({ ...list.params, type: kind, per_page: 25 })
  const base = invoiceBasePath(kind)
  const toast = useToast()
  const actions = useInvoiceActions()
  const [deleting, setDeleting] = useState<Invoice | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await actions.remove.mutateAsync(deleting.id)
      toast.success('Brouillon supprimé.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Numéro',
      cell: (i) => <span className="font-mono">{i.number ?? 'Brouillon'}</span>,
    },
    {
      key: 'partner',
      header: isCustomer ? 'Client' : 'Fournisseur',
      cell: (i) => i.partner?.name ?? '—',
    },
    { key: 'date', header: 'Date', cell: (i) => formatDate(i.invoice_date) },
    { key: 'due', header: 'Échéance', cell: (i) => formatDate(i.due_date) },
    {
      key: 'total',
      header: 'Total TTC',
      align: 'right',
      cell: (i) => formatMoney(i.total, i.currency),
    },
    {
      key: 'due_amount',
      header: 'Reste dû',
      align: 'right',
      cell: (i) => (i.status === 'posted' ? formatMoney(i.amount_due, i.currency) : '—'),
    },
    { key: 'status', header: 'Statut', cell: (i) => <InvoiceStatusBadge status={i.status} /> },
    ...(can('invoices.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (i: Invoice) =>
              i.status === 'draft' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="size-4" aria-hidden="true" />}
                  aria-label={`Supprimer le brouillon de ${i.partner?.name ?? 'la facture'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleting(i)
                  }}
                >
                  Supprimer
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Factures clients' : 'Factures fournisseurs'}
        actions={
          can('invoices.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => navigate(`${base}/new`)}
            >
              Nouvelle facture
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(v) => list.setFilter('search', v)}
            placeholder="Numéro, partenaire…"
          />
          <Select
            aria-label="Filtrer par statut"
            className="sm:w-48"
            value={list.filters.status ?? ''}
            onChange={(e) => list.setFilter('status', e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="posted">Validée</option>
            <option value="paid">Payée</option>
            <option value="cancelled">Annulée</option>
          </Select>
          {isCustomer && (
            <Checkbox
              label="En retard uniquement"
              checked={list.filters.overdue === '1'}
              onChange={(e) => list.setFilter('overdue', e.target.checked ? '1' : '')}
            />
          )}
        </div>
        <DataTable
          caption="Liste des factures"
          columns={columns}
          rows={query.data?.data}
          rowKey={(i) => i.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          onRowClick={(i) => navigate(`${base}/${i.id}`)}
          emptyTitle="Aucune facture"
          emptyDescription="Aucune facture ne correspond aux filtres."
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer le brouillon"
        message="Ce brouillon sera définitivement supprimé. Une facture déjà validée ne se supprime pas : elle s'annule depuis sa fiche."
        confirmLabel="Supprimer"
        danger
        loading={actions.remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
