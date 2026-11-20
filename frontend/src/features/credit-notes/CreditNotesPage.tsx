import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { CreditNoteStatusBadge } from '@/components/ui/StatusBadges'
import { useListParams } from '@/hooks/useListParams'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney } from '@/lib/utils'
import { creditNotesApi } from '@/features/credit-notes/api'
import type { CreditNote } from '@/features/credit-notes/api'
import type { InvoiceType } from '@/types/api'

export function CreditNotesPage({ kind }: { kind: InvoiceType }) {
  const isCustomer = kind === 'customer'
  const title = isCustomer ? 'Avoirs clients' : 'Avoirs fournisseurs'

  const list = useListParams()
  const query = creditNotesApi.useList({
    ...list.params,
    type: kind,
    per_page: 25,
  })

  const columns: Column<CreditNote>[] = [
    {
      key: 'number',
      header: 'N° avoir',
      cell: (note) => (
        <span className="font-mono font-medium">
          {note.number ?? 'Brouillon'}
        </span>
      ),
    },
    {
      key: 'partner',
      header: isCustomer ? 'Client' : 'Fournisseur',
      cell: (note) => note.partner?.name ?? '—',
    },
    {
      key: 'invoice',
      header: 'Facture d’origine',
      cell: (note) => (
        <span className="font-mono">
          {note.invoice?.number ?? '—'}
        </span>
      ),
    },
    ...(isCustomer
      ? []
      : [
          {
            key: 'supplier_reference',
            header: 'Référence fournisseur',
            cell: (note: CreditNote) => note.supplier_reference ?? '—',
          },
        ]),
    {
      key: 'date',
      header: 'Date',
      cell: (note) => formatDate(note.credit_note_date),
    },
    {
      key: 'total',
      header: 'Montant TTC',
      align: 'right',
      cell: (note) => formatMoney(note.total, note.currency),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (note) => <CreditNoteStatusBadge status={note.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        title={title}
        description={
          isCustomer
            ? 'Consultez et gérez les avoirs émis à vos clients.'
            : 'Consultez et gérez les avoirs reçus de vos fournisseurs.'
        }
        breadcrumbs={[
          { label: 'Gestion des avoirs', to: '/credit-notes' },
          { label: title },
        ]}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(value) => list.setFilter('search', value)}
            placeholder={
              isCustomer
                ? 'Rechercher un numéro d’avoir…'
                : 'Rechercher un numéro ou une référence…'
            }
            label="Rechercher un avoir"
          />

          <Select
            value={list.filters.status ?? ''}
            onChange={(event) => list.setFilter('status', event.target.value)}
            className="w-full sm:max-w-xs"
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillons</option>
            <option value="posted">Validés</option>
            <option value="cancelled">Annulés</option>
          </Select>
        </div>

        <DataTable
          caption={title}
          columns={columns}
          rows={query.data?.data}
          rowKey={(note) => note.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun avoir trouvé"
          emptyDescription={
            list.filters.search || list.filters.status
              ? 'Aucun avoir ne correspond aux critères sélectionnés.'
              : isCustomer
                ? 'Aucun avoir client n’a encore été enregistré.'
                : 'Aucun avoir fournisseur n’a encore été enregistré.'
          }
        />

        <Pagination
          meta={query.data?.meta}
          onPageChange={list.setPage}
        />
      </Card>
    </>
  )
}
