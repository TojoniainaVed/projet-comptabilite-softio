import { Download, Plus, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { api } from '@/lib/api-client'
import { EntryStatusBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney, toCents } from '@/lib/utils'
import { entriesApi } from '@/features/entries/api'
import { journalsApi } from '@/features/settings/api'
import type { JournalEntry } from '@/types/api'

export function JournalEntriesPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const list = useListParams()
  const query = entriesApi.useList({ ...list.params, per_page: 25 })
  const journals = journalsApi.useOptions()

  const totalAmount = (entry: JournalEntry, type: 'debit' | 'credit') => {
    const cents = entry.lines?.reduce((total, line) => total + toCents(line[type]), 0) ?? 0

    return formatMoney(cents / 100)
  }

  const columns: Column<JournalEntry>[] = [
    {
      key: 'ref',
      header: 'Référence',
      cell: (e) => <span className="font-mono">{e.reference ?? '—'}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      cell: (e) => formatDate(e.entry_date),
    },
    {
      key: 'journal',
      header: 'Journal',
      cell: (e) => e.journal?.code ?? '—',
    },
    {
      key: 'desc',
      header: 'Libellé',
      cell: (e) => e.description,
    },
    {
      key: 'debit',
      header: 'Total débit',
      align: 'right',
      cell: (e) => <span className="font-medium tabular-nums">{totalAmount(e, 'debit')}</span>,
    },
    {
      key: 'credit',
      header: 'Total crédit',
      align: 'right',
      cell: (e) => <span className="font-medium tabular-nums">{totalAmount(e, 'credit')}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (e) => <EntryStatusBadge status={e.status} />,
    },
  ]

  const resetFilters = () => {
    list.setFilter('search', '')
    list.setFilter('status', '')
    list.setFilter('journal_id', '')
    list.setFilter('from', '')
    list.setFilter('to', '')
  }

  const hasFilters = Object.values(list.filters).some((value) => value !== '')

  const exportCsv = async () => {
    try {
      await api.download('/journal-entries/export', 'ecritures.csv', {
        status: list.filters.status,
        journal_id: list.filters.journal_id,
        from: list.filters.from,
        to: list.filters.to,
      })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Écritures comptables"
        description="Une écriture validée est immuable : elle ne peut être corrigée que par contrepassation."
        actions={
          <>
            {can('entries.export') && (
              <Button
                variant="secondary"
                icon={<Download className="size-4" aria-hidden="true" />}
                onClick={() => void exportCsv()}
              >
                Exporter (CSV)
              </Button>
            )}
            {can('entries.create') && (
              <Button
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => navigate('/journal-entries/new')}
              >
                Nouvelle écriture
              </Button>
            )}
          </>
        }
      />

      <Card padded={false}>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-6">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(v) => list.setFilter('search', v)}
            placeholder="Libellé, référence"
          />

          <Select
            aria-label="Filtrer par statut"
            value={list.filters.status ?? ''}
            onChange={(e) => list.setFilter('status', e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="posted">Validée</option>
            <option value="reversed">Contrepassée</option>
          </Select>

          <Select
            aria-label="Filtrer par journal"
            value={list.filters.journal_id ?? ''}
            onChange={(e) => list.setFilter('journal_id', e.target.value)}
          >
            <option value="">Tous les journaux</option>
            {journals.data?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} — {j.name}
              </option>
            ))}
          </Select>

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

          <Button
            variant="secondary"
            disabled={!hasFilters}
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={resetFilters}
          >
            Réinitialiser
          </Button>
        </div>

        <DataTable
          caption="Liste des écritures"
          columns={columns}
          rows={query.data?.data}
          rowKey={(e) => e.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          onRowClick={(e) => navigate(`/journal-entries/${e.id}`)}
          emptyTitle="Aucune écriture"
          emptyDescription="Aucune écriture ne correspond aux filtres."
        />

        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
