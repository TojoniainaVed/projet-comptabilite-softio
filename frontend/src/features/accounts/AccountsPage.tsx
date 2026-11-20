import { Fragment, useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderX,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
} from 'lucide-react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { ActiveBadge } from '@/components/ui/StatusBadges'

import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { accountCategoryLabels, accountTypeLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'

import { accountsApi } from '@/features/accounts/api'
import { AccountFormModal } from '@/features/accounts/AccountFormModal'

import type { Account } from '@/types/api'

type AccountNode = Account & {
  children: AccountNode[]
}

const classTabs = [
  { value: '1', label: 'Classe 1 · Capitaux' },
  { value: '2', label: 'Classe 2 · Immobilisations' },
  { value: '3', label: 'Classe 3 · Stocks' },
  { value: '4', label: 'Classe 4 · Tiers' },
  { value: '5', label: 'Classe 5 · Financiers' },
  { value: '6', label: 'Classe 6 · Charges' },
  { value: '7', label: 'Classe 7 · Produits' },
]

type StatusFilter = 'all' | 'active' | 'inactive'

function buildAccountTree(accounts: Account[]): AccountNode[] {
  const nodes = new Map<number, AccountNode>()

  for (const account of accounts) {
    nodes.set(account.id, { ...account, children: [] })
  }

  const roots: AccountNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parent_id !== null ? nodes.get(node.parent_id) : undefined

    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (items: AccountNode[]): void => {
    items.sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true }))

    items.forEach((item) => sortNodes(item.children))
  }

  sortNodes(roots)

  return roots
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function exportAccounts(accounts: Account[]) {
  const headers = ['Code', 'Intitulé', 'Type', 'Rôle', 'Statut']

  const rows = accounts.map((account) => [
    account.code,
    account.name,
    accountTypeLabels[account.type],
    account.category ? accountCategoryLabels[account.category] : '',
    account.is_active ? 'Actif' : 'Inactif',
  ])

  const csv = [
    headers.map(escapeCsv).join(';'),
    ...rows.map((row) => row.map((value) => escapeCsv(String(value))).join(';')),
  ].join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'plan-comptable-softio.csv'
  link.click()

  URL.revokeObjectURL(url)
}

interface AccountRowsProps {
  nodes: AccountNode[]
  level: number
  collapsed: Set<number>
  onToggle: (id: number) => void
  onEdit: (account: Account) => void
  canEdit: boolean
}

function AccountRows({ nodes, level, collapsed, onToggle, onEdit, canEdit }: AccountRowsProps) {
  return (
    <>
      {nodes.map((account) => {
        const hasChildren = account.children.length > 0
        const isCollapsed = collapsed.has(account.id)

        return (
          <Fragment key={account.id}>
            <tr className="border-b border-line transition-colors hover:bg-surface">
              <td className="whitespace-nowrap px-4 py-3">
                <span className="font-mono text-sm font-medium">{account.code}</span>
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-surface"
                      onClick={() => onToggle(account.id)}
                      aria-label={isCollapsed ? 'Développer' : 'Réduire'}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span className="inline-block size-7 shrink-0" />
                  )}

                  {account.is_group ? (
                    <Folder className="size-4 shrink-0 text-amber-600" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted" />
                  )}

                  <span className="font-medium">{account.name}</span>

                  {account.is_group && (
                    <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted">
                      Regroupement
                    </span>
                  )}
                </div>
              </td>

              <td className="px-4 py-3 text-sm">{accountTypeLabels[account.type]}</td>

              <td className="px-4 py-3 text-sm text-muted">
                {account.category ? accountCategoryLabels[account.category] : '—'}
              </td>

              <td className="px-4 py-3">
                <ActiveBadge active={account.is_active} />
              </td>

              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="size-4" aria-hidden="true" />}
                    onClick={() => onEdit(account)}
                    aria-label={`Modifier le compte ${account.code}`}
                  >
                    Modifier
                  </Button>
                </td>
              )}
            </tr>

            {hasChildren && !isCollapsed && (
              <AccountRows
                nodes={account.children}
                level={level + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                onEdit={onEdit}
                canEdit={canEdit}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
}

export function AccountsPage() {
  const { can } = useAuth()
  const list = useListParams()

  // Liste complète limitée à 500 comptes par le backend.
  const allQuery = accountsApi.useOptions()

  // Comptes correspondant à la recherche et à la classe sélectionnée.
  const filteredQuery = accountsApi.useOptions({
    ...list.filters,
  })

  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())

  const [showClasses, setShowClasses] = useState(false)
  const [showPcg, setShowPcg] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const allAccounts = allQuery.data ?? []
  const filteredAccounts = filteredQuery.data ?? []

  // Filtrage des comptes selon leur statut.
  const visibleAccounts = useMemo(
    () =>
      filteredAccounts.filter((account) => {
        if (statusFilter === 'active') {
          return account.is_active
        }

        if (statusFilter === 'inactive') {
          return !account.is_active
        }

        return true
      }),
    [filteredAccounts, statusFilter],
  )

  // Construction de l'arborescence.
  const tree = useMemo(() => buildAccountTree(visibleAccounts), [visibleAccounts])

  // Statistiques calculées à partir des comptes récupérés.
  const activeCount = allAccounts.filter((account) => account.is_active).length

  const totalCount = allAccounts.length
  const inactiveCount = totalCount - activeCount

  const representedClasses = new Set(
    allAccounts.map((account) => account.code.charAt(0)).filter((code) => /^[1-7]$/.test(code)),
  ).size

  const toggleAccount = (id: number) => {
    setCollapsed((previous) => {
      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const resetTree = () => {
    setCollapsed(new Set())
  }

  const changeFilter = (key: string, value: string) => {
    list.setFilter(key, value)
    resetTree()
  }

  const refresh = async () => {
    await Promise.all([allQuery.refetch(), filteredQuery.refetch()])
  }

  const toggleStatusFilter = (status: StatusFilter) => {
    setStatusFilter((previous) => (previous === status ? 'all' : status))

    setShowClasses(false)
    setShowPcg(false)
    resetTree()
  }

  const canCreate = can('accounts.create')
  const canEdit = can('accounts.update')

  return (
    <>
      <PageHeader
        title="Plan comptable"
        description="Consultez et gérez votre plan comptable selon le PCG 2005."
      />

      {/* Cartes statistiques interactives */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setShowClasses((previous) => !previous)
            setShowPcg(false)
          }}
          aria-expanded={showClasses}
          className="block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Classes comptables"
            value={representedClasses}
            hint={
              showClasses
                ? 'Cliquer pour fermer les classes'
                : 'Cliquer pour consulter les 7 classes'
            }
            icon={<Scale className="size-5 text-blue-600" />}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleStatusFilter('active')}
          aria-pressed={statusFilter === 'active'}
          className="block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Comptes actifs"
            value={activeCount}
            hint={
              statusFilter === 'active'
                ? 'Filtre actif · Cliquer pour réinitialiser'
                : 'Cliquer pour consulter les comptes actifs'
            }
            icon={<Folder className="size-5 text-emerald-600" />}
          />
        </button>

        <button
          type="button"
          onClick={() => toggleStatusFilter('inactive')}
          aria-pressed={statusFilter === 'inactive'}
          className="block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Comptes inactifs"
            value={inactiveCount}
            hint={
              statusFilter === 'inactive'
                ? 'Filtre actif · Cliquer pour réinitialiser'
                : 'Cliquer pour consulter les comptes inactifs'
            }
            icon={<FolderX className="size-5 text-orange-600" />}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowPcg((previous) => !previous)
            setShowClasses(false)
          }}
          aria-expanded={showPcg}
          className="block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Référentiel"
            value="PCG 2005"
            hint="Cliquer pour consulter le référentiel"
            icon={<BookOpen className="size-5 text-violet-600" />}
          />
        </button>
      </div>

      {/* Panneau des sept classes comptables */}
      {showClasses && (
        <Card className="mb-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink">Classes comptables</h3>

              <p className="mt-1 text-sm text-muted">
                Sélectionnez une classe pour consulter ses comptes.
              </p>
            </div>

            <Button size="sm" variant="ghost" onClick={() => setShowClasses(false)}>
              Fermer
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {classTabs.map((tab) => {
              const count = allAccounts.filter((account) =>
                account.code.startsWith(tab.value),
              ).length

              const selected = list.filters.class === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    changeFilter('class', tab.value)
                    setStatusFilter('all')
                    setShowClasses(false)
                  }}
                  className={[
                    'rounded-xl border p-4 text-left transition',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-line hover:border-primary hover:bg-surface',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{tab.label}</span>

                    {selected && (
                      <span className="text-xs font-medium text-primary">Sélectionnée</span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-muted">{count} compte(s)</p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                changeFilter('class', '')
                setStatusFilter('all')
                setShowClasses(false)
              }}
            >
              Afficher toutes les classes
            </Button>
          </div>
        </Card>
      )}

      {/* Lecteur du référentiel officiel PCG 2005 */}
      {showPcg && (
        <Card className="mb-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-violet-600" />

                <h3 className="font-semibold text-ink">Plan Comptable Général 2005</h3>
              </div>

              <p className="mt-1 text-sm text-muted">
                Consultez le document officiel du PCG 2005 directement dans Softio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/documents/pcg-2005.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-sm font-medium transition hover:bg-surface"
              >
                <BookOpen className="mr-2 size-4" />
                Nouvel onglet
              </a>

              <a
                href="/documents/pcg-2005.pdf"
                download="PCG-2005-Madagascar.pdf"
                className="inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-sm font-medium transition hover:bg-surface"
              >
                <Download className="mr-2 size-4" />
                Télécharger
              </a>

              <Button size="sm" variant="ghost" onClick={() => setShowPcg(false)}>
                Fermer
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <iframe
              src="/documents/pcg-2005.pdf"
              title="Plan Comptable Général 2005 de Madagascar"
              className="h-[75vh] min-h-[550px] w-full"
            />
          </div>

          <p className="mt-3 text-xs text-muted">
            Document de référence : Plan Comptable Général 2005 de Madagascar. Si le lecteur PDF ne
            s'affiche pas dans votre navigateur, utilisez le bouton « Nouvel onglet ».
          </p>
        </Card>
      )}

      {/* Liste des comptes */}
      <Card padded={false}>
        <div className="space-y-4 border-b border-line p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" icon={<Network className="size-4" />}>
                Vue arborescence
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="size-4" />}
                disabled={allQuery.isLoading || totalCount === 0}
                onClick={() => exportAccounts(allAccounts)}
              >
                Exporter
              </Button>

              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw className="size-4" />}
                loading={allQuery.isFetching || filteredQuery.isFetching}
                onClick={() => void refresh()}
              >
                Actualiser
              </Button>

              {canCreate && (
                <Button
                  size="sm"
                  icon={<Plus className="size-4" />}
                  onClick={() => setEditing('new')}
                >
                  Nouveau compte
                </Button>
              )}
            </div>
          </div>

          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(value) => changeFilter('search', value)}
            placeholder="Rechercher par code ou intitulé..."
          />

          {statusFilter !== 'all' && (
            <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-sm text-muted">
                Filtre : {statusFilter === 'active' ? 'Comptes actifs' : 'Comptes inactifs'}
              </span>

              <Button size="sm" variant="ghost" onClick={() => setStatusFilter('all')}>
                Réinitialiser
              </Button>
            </div>
          )}
        </div>

        {/* Chargement et erreurs */}
        {allQuery.isLoading || filteredQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement des comptes...</div>
        ) : allQuery.isError || filteredQuery.isError ? (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-danger">
              {errorMessage(allQuery.error ?? filteredQuery.error)}
            </p>

            <Button variant="secondary" onClick={() => void refresh()}>
              Réessayer
            </Button>
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">Aucun compte trouvé</p>

            <p className="mt-1 text-sm text-muted">
              Modifiez votre recherche ou réinitialisez les filtres.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-line bg-surface text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Intitulé du compte</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>

                  {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>

              <tbody>
                <AccountRows
                  nodes={tree}
                  level={0}
                  collapsed={collapsed}
                  onToggle={toggleAccount}
                  onEdit={setEditing}
                  canEdit={canEdit}
                />
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-line px-4 py-3 text-xs text-muted">
          {visibleAccounts.length} compte(s) affiché(s).
          {filteredAccounts.length >= 500 &&
            ' La limite de récupération de 500 éléments est atteinte.'}
        </div>
      </Card>

      <AccountFormModal account={editing} onClose={() => setEditing(null)} />
    </>
  )
}
