import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, Pencil, Plus } from 'lucide-react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { ActiveBadge } from '@/components/ui/StatusBadges'

import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { accountCategoryLabels, accountTypeLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'

import { accountsApi } from '@/features/accounts/api'
import { AccountFormModal } from '@/features/accounts/AccountFormModal'

import type { Account, AccountType } from '@/types/api'

type AccountNode = Account & {
  children: AccountNode[]
}

/**
 * Première ligne : classes du Plan Comptable Général.
 */
const classTabs: {
  value: '' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
  label: string
}[] = [
  { value: '', label: 'Toutes les classes' },
  { value: '1', label: 'Classe 1 · Capitaux' },
  { value: '2', label: 'Classe 2 · Immobilisations' },
  { value: '3', label: 'Classe 3 · Stocks' },
  { value: '4', label: 'Classe 4 · Tiers' },
  { value: '5', label: 'Classe 5 · Financiers' },
  { value: '6', label: 'Classe 6 · Charges' },
  { value: '7', label: 'Classe 7 · Produits' },
]

/**
 * Deuxième ligne : types de comptes.
 */
const typeTabs: {
  value: '' | AccountType
  label: string
}[] = [
  { value: '', label: 'Tous les types' },
  { value: 'asset', label: accountTypeLabels.asset },
  { value: 'liability', label: accountTypeLabels.liability },
  { value: 'equity', label: accountTypeLabels.equity },
  { value: 'expense', label: accountTypeLabels.expense },
  { value: 'income', label: accountTypeLabels.income },
]

/**
 * Transforme la liste des comptes en arborescence
 * à partir du champ parent_id.
 */
function buildAccountTree(accounts: Account[]): AccountNode[] {
  const nodes = new Map<number, AccountNode>()

  for (const account of accounts) {
    nodes.set(account.id, {
      ...account,
      children: [],
    })
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

interface AccountRowsProps {
  nodes: AccountNode[]
  level: number
  collapsed: Set<number>
  onToggle: (id: number) => void
  onEdit: (account: Account) => void
  canEdit: boolean
}

/**
 * Affichage récursif des comptes et de leurs sous-comptes.
 */
function AccountRows({ nodes, level, collapsed, onToggle, onEdit, canEdit }: AccountRowsProps) {
  return (
    <>
      {nodes.map((account) => {
        const hasChildren = account.children.length > 0
        const isCollapsed = collapsed.has(account.id)

        return (
          <Fragment key={account.id}>
            <tr className="border-b border-line transition-colors hover:bg-surface">
              {/* Code du compte */}
              <td className="whitespace-nowrap px-4 py-3">
                <span className="font-mono text-sm font-medium">{account.code}</span>
              </td>

              {/* Intitulé et hiérarchie */}
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

              {/* Type */}
              <td className="px-4 py-3 text-sm">{accountTypeLabels[account.type]}</td>

              {/* Catégorie */}
              <td className="px-4 py-3 text-sm text-muted">
                {account.category ? accountCategoryLabels[account.category] : '—'}
              </td>

              {/* Statut */}
              <td className="px-4 py-3">
                <ActiveBadge active={account.is_active} />
              </td>

              {/* Action de modification */}
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

            {/* Sous-comptes */}
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

/**
 * Page principale du plan comptable.
 */
export function AccountsPage() {
  const { can } = useAuth()
  const list = useListParams()

  const query = accountsApi.useList({
    ...list.params,
    per_page: 100,
  })

  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())

  const accounts = query.data?.data ?? []

  const tree = useMemo(() => buildAccountTree(accounts), [accounts])

  const activeClass = list.filters.class ?? ''
  const activeType = list.filters.type ?? ''

  /**
   * Développer ou réduire un compte.
   */
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

  /**
   * Réinitialiser le repli de l'arborescence
   * lorsqu'un filtre change.
   */
  const resetTree = () => {
    setCollapsed(new Set())
  }

  return (
    <>
      <PageHeader
        title="Plan comptable"
        description="Consultez et organisez les comptes de votre entreprise."
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
        <div className="space-y-5 border-b border-line p-4">
          {/* Recherche */}
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(value) => {
              list.setFilter('search', value)
              resetTree()
            }}
            placeholder="Rechercher par code ou intitulé..."
          />

          {/* Les deux menus horizontaux */}
          <div className="space-y-4">
            {/* PREMIÈRE LIGNE : CLASSES DU PCG */}
            <div className="border-b border-line pb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Classes du plan comptable
              </p>

              <div
                className="flex flex-nowrap gap-2 overflow-x-auto pb-2"
                role="group"
                aria-label="Classes du plan comptable"
              >
                {classTabs.map((tab) => {
                  const selected = activeClass === tab.value

                  return (
                    <button
                      key={tab.value || 'all-classes'}
                      type="button"
                      onClick={() => {
                        list.setFilter('class', tab.value)
                        resetTree()
                      }}
                      aria-pressed={selected}
                      className={[
                        'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        selected
                          ? 'bg-primary text-white'
                          : 'border border-line text-muted hover:bg-surface',
                      ].join(' ')}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* DEUXIÈME LIGNE : TYPES DE COMPTES */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Types de comptes
              </p>

              <div
                className="flex flex-nowrap gap-2 overflow-x-auto pb-2"
                role="group"
                aria-label="Types de comptes"
              >
                {typeTabs.map((tab) => {
                  const selected = activeType === tab.value

                  return (
                    <button
                      key={tab.value || 'all-types'}
                      type="button"
                      onClick={() => {
                        list.setFilter('type', tab.value)
                        resetTree()
                      }}
                      aria-pressed={selected}
                      className={[
                        'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        selected
                          ? 'bg-primary text-white'
                          : 'border border-line text-muted hover:bg-surface',
                      ].join(' ')}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chargement */}
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement des comptes...</div>
        ) : query.isError ? (
          /* Erreur */
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-danger">{errorMessage(query.error)}</p>

            <Button variant="secondary" onClick={() => void query.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          /* Aucun résultat */
          <div className="p-8 text-center">
            <p className="font-medium">Aucun compte trouvé</p>

            <p className="mt-1 text-sm text-muted">
              Modifiez votre recherche ou choisissez une autre catégorie.
            </p>
          </div>
        ) : (
          /* Tableau des comptes */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="border-b border-line bg-surface text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>

                  <th className="px-4 py-3 font-medium">Intitulé du compte</th>

                  <th className="px-4 py-3 font-medium">Type</th>

                  <th className="px-4 py-3 font-medium">Rôle</th>

                  <th className="px-4 py-3 font-medium">Statut</th>

                  {can('accounts.update') && (
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                <AccountRows
                  nodes={tree}
                  level={0}
                  collapsed={collapsed}
                  onToggle={toggleAccount}
                  onEdit={setEditing}
                  canEdit={can('accounts.update')}
                />
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>

      {/* Fenêtre de création et de modification */}
      <AccountFormModal account={editing} onClose={() => setEditing(null)} />
    </>
  )
}
