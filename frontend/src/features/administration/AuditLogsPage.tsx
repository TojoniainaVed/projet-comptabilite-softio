import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { DatePicker } from '@/components/ui/DatePicker'
import { useListParams } from '@/hooks/useListParams'
import { errorMessage } from '@/lib/form-errors'
import { formatDateTime } from '@/lib/utils'
import { auditLogsApi } from '@/features/administration/api'
import type { AuditLog } from '@/types/api'

export function AuditLogsPage() {
  const list = useListParams()
  const query = auditLogsApi.useList({ ...list.params, per_page: 25 })
  const [open, setOpen] = useState<number | null>(null)

  const columns: Column<AuditLog>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (l) => <span className="whitespace-nowrap">{formatDateTime(l.created_at)}</span>,
    },
    { key: 'user', header: 'Utilisateur', cell: (l) => l.user?.name ?? 'Système' },
    {
      key: 'action',
      header: 'Action',
      cell: (l) => <span className="font-mono text-xs">{l.action}</span>,
    },
    {
      key: 'subject',
      header: 'Objet',
      cell: (l) => (l.subject_type ? `${l.subject_type.split('\\').pop()} #${l.subject_id}` : '—'),
    },
    { key: 'ip', header: 'Adresse IP', cell: (l) => l.ip_address ?? '—' },
    {
      key: 'details',
      header: 'Détails',
      cell: (l) => {
        const hasMeta = l.metadata && Object.keys(l.metadata).length > 0
        if (!hasMeta) return '—'
        const expanded = open === l.id
        return (
          <div>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : l.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              {expanded ? (
                <ChevronDown className="size-3" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3" aria-hidden="true" />
              )}
              {expanded ? 'Masquer' : 'Afficher'}
            </button>
            {expanded && (
              <pre className="mt-1 max-w-xs overflow-x-auto rounded-control bg-canvas p-2 text-xs">
                {JSON.stringify(l.metadata, null, 2)}
              </pre>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        description="Trace immuable des actions sensibles. Les mots de passe et jetons n'y figurent jamais."
      />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <SearchInput
            value={list.filters.action ?? ''}
            onChange={(v) => list.setFilter('action', v)}
            placeholder="Action (ex. user.)"
            label="Filtrer par action"
          />
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
          caption="Journal d'audit"
          columns={columns}
          rows={query.data?.data}
          rowKey={(l) => l.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucune trace"
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
