import { useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/form-errors'
import {
  usePermissionCatalog,
  useRoles,
  useUpdateRolePermissions,
} from '@/features/administration/api'

const resourceLabels: Record<string, string> = {
  accounts: 'Plan comptable',
  journals: 'Journaux',
  fiscal_years: 'Exercices',
  entries: 'Écritures',
  partners: 'Clients / fournisseurs',
  invoices: 'Factures',
  payments: 'Paiements',
  expenses: 'Dépenses',
  reports: 'Rapports',
  users: 'Utilisateurs',
  roles: 'Rôles',
  companies: 'Entreprises',
  settings: 'Paramètres',
  audit: "Journal d'audit",
  sessions: 'Sessions',
}

const actionLabels: Record<string, string> = {
  view: 'Consulter',
  create: 'Créer',
  update: 'Modifier',
  validate: 'Valider',
  cancel: 'Annuler',
  export: 'Exporter',
  administer: 'Administrer',
}

export function RolesPage() {
  const { can } = useAuth()
  const toast = useToast()
  const roles = useRoles()
  const catalog = usePermissionCatalog()
  const save = useUpdateRolePermissions()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Modifications non enregistrées, par rôle : changer de rôle ne les perd pas.
  const [drafts, setDrafts] = useState<Record<number, string[]>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const selected = roles.data?.find((r) => r.id === (selectedId ?? roles.data?.[0]?.id))
  const draft = new Set(selected ? (drafts[selected.id] ?? selected.permissions ?? []) : [])
  const dirty = selected !== undefined && drafts[selected.id] !== undefined

  if (roles.isLoading || catalog.isLoading) return <LoadingSpinner />
  if (roles.isError || catalog.isError || !roles.data || !catalog.data) {
    return (
      <ErrorState
        message={errorMessage(roles.error ?? catalog.error)}
        onRetry={() => {
          void roles.refetch()
          void catalog.refetch()
        }}
      />
    )
  }

  const editable = can('roles.administer')

  const toggle = (slug: string) => {
    if (!selected) return
    const next = new Set(draft)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    const original = [...(selected.permissions ?? [])].sort().join('|')
    const changed = [...next].sort().join('|') !== original
    setDrafts((current) => {
      const { [selected.id]: _removed, ...rest } = current
      return changed ? { ...rest, [selected.id]: [...next] } : rest
    })
  }

  const onSave = async () => {
    if (!selected) return
    setSaveError(null)
    try {
      await save.mutateAsync({ id: selected.id, permissions: [...draft] })
      setDrafts((current) => {
        const { [selected.id]: _removed, ...rest } = current
        return rest
      })
      toast.success('Permissions enregistrées.')
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }

  // Les permissions d'un rôle d'entreprise sont limitées aux ressources applicables à son périmètre.
  const groups = catalog.data

  return (
    <>
      <PageHeader
        title="Rôles et permissions"
        description="Les rôles sont communs à toutes les entreprises : une modification s'applique à tous les utilisateurs du rôle."
        actions={
          editable && (
            <Button
              icon={<Save className="size-4" aria-hidden="true" />}
              onClick={() => void onSave()}
              disabled={!dirty}
              loading={save.isPending}
            >
              Enregistrer
            </Button>
          )
        }
      />
      {saveError && (
        <div className="mb-4">
          <InlineAlert>{saveError}</InlineAlert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card title="Rôles" padded={false}>
          <ul>
            {roles.data.map((role) => {
              const active = role.id === selected?.id
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(role.id)
                      setSaveError(null)
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full flex-col items-start gap-1 border-b border-line px-4 py-3 text-left text-sm last:border-0 ${active ? 'bg-brand-50' : 'hover:bg-canvas'}`}
                  >
                    <span className="font-medium">{role.name}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      <Badge tone={role.scope === 'platform' ? 'info' : 'neutral'}>
                        {role.scope === 'platform' ? 'Plateforme' : 'Entreprise'}
                      </Badge>
                      {role.users_count ?? 0} utilisateur(s)
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title={selected ? `Permissions — ${selected.name}` : 'Permissions'} padded={false}>
          {selected?.description && (
            <p className="border-b border-line px-5 py-3 text-sm text-ink-muted">
              {selected.description}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">
                Matrice des permissions du rôle {selected?.name}
              </caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2">
                    Ressource
                  </th>
                  {Object.keys(actionLabels).map((action) => (
                    <th key={action} scope="col" className="px-2 py-2 text-center">
                      {actionLabels[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.resource} className="border-b border-line">
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {resourceLabels[group.resource] ?? group.resource}
                    </th>
                    {Object.keys(actionLabels).map((action) => {
                      const slug = `${group.resource}.${action}`
                      const exists = group.actions.includes(action)
                      return (
                        <td key={action} className="px-2 py-2 text-center">
                          {exists ? (
                            <input
                              type="checkbox"
                              className="size-4 accent-brand-600"
                              checked={draft.has(slug)}
                              disabled={!editable}
                              onChange={() => toggle(slug)}
                              aria-label={`${actionLabels[action]} — ${resourceLabels[group.resource] ?? group.resource}`}
                            />
                          ) : (
                            <span aria-hidden="true" className="text-line">
                              –
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
