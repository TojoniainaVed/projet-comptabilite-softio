import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { accountCategoryLabels, accountTypeLabels, optionsOf } from '@/lib/labels'
import { ActiveBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { accountsApi } from '@/features/accounts/api'
import { AccountFormModal } from '@/features/accounts/AccountFormModal'
import type { Account } from '@/types/api'

export function AccountsPage() {
  const { can } = useAuth()
  const list = useListParams()
  const query = accountsApi.useList({ ...list.params, per_page: 25 })
  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  const columns: Column<Account>[] = [
    { key: 'code', header: 'Code', cell: (a) => <span className="font-mono">{a.code}</span> },
    { key: 'name', header: 'Intitulé', cell: (a) => a.name },
    { key: 'type', header: 'Type', cell: (a) => accountTypeLabels[a.type] },
    {
      key: 'category',
      header: 'Rôle',
      cell: (a) => (a.category ? accountCategoryLabels[a.category] : '—'),
    },
    { key: 'active', header: 'Statut', cell: (a) => <ActiveBadge active={a.is_active} /> },
    ...(can('accounts.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (a: Account) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(a)}
                aria-label={`Modifier le compte ${a.code}`}
              >
                Modifier
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Plan comptable"
        description="Comptes utilisables dans les écritures. Le plan fourni par défaut est simplifié : adaptez-le à votre cadre comptable."
        actions={
          can('accounts.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              Nouveau compte
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(value) => list.setFilter('search', value)}
            placeholder="Code ou intitulé"
          />
          <Select
            aria-label="Filtrer par type"
            className="sm:w-52"
            value={list.filters.type ?? ''}
            onChange={(event) => list.setFilter('type', event.target.value)}
          >
            <option value="">Tous les types</option>
            {optionsOf(accountTypeLabels).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          caption="Liste des comptes"
          columns={columns}
          rows={query.data?.data}
          rowKey={(a) => a.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun compte"
          emptyDescription="Aucun compte ne correspond à votre recherche."
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <AccountFormModal account={editing} onClose={() => setEditing(null)} />
    </>
  )
}
