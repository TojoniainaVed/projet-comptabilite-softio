
import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2, Users, Truck, Search, Filter } from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { ActiveBadge } from '@/components/ui/StatusBadges'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { emptyToNull } from '@/lib/validation'
import { customersApi, suppliersApi } from '@/features/partners/api'
import type { Partner } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(255),
  email: z.union([z.literal(''), z.string().trim().email("Format d'e-mail invalide.")]),
  phone: z.string().max(40),
  tax_id: z.string().max(50),
  address: z.string().max(1000),
  is_active: z.boolean(),
})

type Values = z.infer<typeof schema>

const empty: Values = {
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  address: '',
  is_active: true,
}

export function PartnersPage({ kind }: { kind: 'customer' | 'supplier' }) {
  const isCustomer = kind === 'customer'
  const api = isCustomer ? customersApi : suppliersApi
  const noun = isCustomer ? 'client' : 'fournisseur'

  const { can } = useAuth()
  const list = useListParams()
  const query = api.useList({ ...list.params, per_page: 25 })
  const toast = useToast()
  const remove = api.useRemove()

  const [editing, setEditing] = useState<Partner | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Partner | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return

    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`${deleting.name} supprimé.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  const columns: Column<Partner>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (p) => (
        <div className="min-w-[150px]">
          <p className="font-semibold text-ink">{p.name}</p>
          <p className="text-xs text-muted">
            {isCustomer ? 'Client' : 'Fournisseur'}
          </p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'E-mail',
      cell: (p) => p.email ?? '—',
    },
    {
      key: 'phone',
      header: 'Téléphone',
      cell: (p) => p.phone ?? '—',
    },
    {
      key: 'tax',
      header: 'N° fiscal',
      cell: (p) => p.tax_id ?? '—',
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (p) => <ActiveBadge active={p.is_active} />,
    },
    ...(can('partners.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (p: Partner) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil className="size-4" aria-hidden="true" />}
                  onClick={() => setEditing(p)}
                  aria-label={`Modifier ${p.name}`}
                >
                  Modifier
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="size-4" aria-hidden="true" />}
                  onClick={() => setDeleting(p)}
                  aria-label={`Supprimer ${p.name}`}
                >
                  Supprimer
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Clients' : 'Fournisseurs'}
        description={
          isCustomer
            ? 'Centralisez les informations de vos clients et gérez vos relations commerciales.'
            : 'Retrouvez les informations de vos fournisseurs et gérez vos relations d’achat.'
        }
        actions={
          can('partners.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              Nouveau {noun}
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {isCustomer ? (
                <Users className="size-5" aria-hidden="true" />
              ) : (
                <Truck className="size-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted">Gestion des {noun}s</p>
              <p className="font-semibold text-ink">
                {isCustomer ? 'Répertoire clients' : 'Répertoire fournisseurs'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-surface-subtle text-muted">
              <Filter className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted">Organisation</p>
              <p className="font-semibold text-ink">
                Recherche et filtrage des partenaires
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-md">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <Search className="size-4 text-muted" aria-hidden="true" />
                Rechercher un {noun}
              </label>
              <SearchInput
                value={list.filters.search ?? ''}
                onChange={(value) => list.setFilter('search', value)}
                placeholder="Nom ou adresse e-mail..."
              />
            </div>

            <div className="w-full lg:w-56">
              <label
                htmlFor="partner-status-filter"
                className="mb-2 block text-sm font-medium text-ink"
              >
                Statut
              </label>
              <Select
                id="partner-status-filter"
                value={list.filters.is_active ?? 'all'}
                onChange={(event) =>
                  list.setFilter(
                    'is_active',
                    event.target.value === 'all' ? '' : event.target.value,
                  )
                }
              >
                <option value="all">Tous les partenaires</option>
                <option value="true">Actifs uniquement</option>
                <option value="false">Inactifs uniquement</option>
              </Select>
            </div>
          </div>
        </div>

        <DataTable
          caption={`Liste des ${noun}s`}
          columns={columns}
          rows={query.data?.data}
          rowKey={(p) => p.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle={`Aucun ${noun}`}
          emptyDescription={
            list.filters.search || list.filters.is_active
              ? 'Aucun résultat ne correspond à vos critères de recherche.'
              : `Ajoutez votre premier ${noun} pour pouvoir saisir des ${isCustomer ? 'factures de vente' : 'factures d’achat et dépenses'}.`
          }
        />

        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>

      <PartnerFormModal
        kind={kind}
        partner={editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Supprimer le ${noun}`}
        message={`${deleting?.name ?? ''} sera définitivement supprimé. Si ce ${noun} a déjà des factures ou des dépenses, la suppression est refusée : désactivez-le plutôt.`}
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

function PartnerFormModal(props: ComponentProps<typeof PartnerFormModalBody>) {
  if (props.partner === null) return null

  const key =
    props.partner === 'new'
      ? `${props.kind}-new`
      : `${props.kind}-${props.partner.id}`

  return <PartnerFormModalBody key={key} {...props} />
}

function PartnerFormModalBody({
  kind,
  partner,
  onClose,
}: {
  kind: 'customer' | 'supplier'
  partner: Partner | 'new' | null
  onClose: () => void
}) {
  const api = kind === 'customer' ? customersApi : suppliersApi
  const toast = useToast()

  const create = api.useCreate()
  const update = api.useUpdate()

  const [formError, setFormError] = useState<string | null>(null)

  const editing =
    partner !== null && partner !== 'new' ? partner : null

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: editing.name,
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          tax_id: editing.tax_id ?? '',
          address: editing.address ?? '',
          is_active: editing.is_active,
        }
      : empty,
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const input = {
      name: values.name,
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      tax_id: emptyToNull(values.tax_id),
      address: emptyToNull(values.address),
      is_active: values.is_active,
    }

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input })
      } else {
        await create.mutateAsync(input)
      }

      toast.success(editing ? 'Modifications enregistrées.' : 'Partenaire ajouté.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  const noun = kind === 'customer' ? 'client' : 'fournisseur'

  return (
    <Modal
      open={partner !== null}
      onClose={onClose}
      size="lg"
      title={
        editing
          ? `Modifier le ${noun}`
          : kind === 'customer'
            ? 'Nouveau client'
            : 'Nouveau fournisseur'
      }
      description={
        editing
          ? 'Mettez à jour les informations de ce partenaire.'
          : `Renseignez les informations nécessaires pour ajouter un ${noun}.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="partner-form"
            loading={isSubmitting}
          >
            {editing ? 'Enregistrer les modifications' : 'Créer le partenaire'}
          </Button>
        </>
      }
    >
      <form
        id="partner-form"
        onSubmit={onSubmit}
        noValidate
        className="space-y-6"
      >
        {formError && <InlineAlert>{formError}</InlineAlert>}

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Informations générales
            </h3>
            <p className="mt-1 text-xs text-muted">
              Identifiez votre {noun} dans le système comptable.
            </p>
          </div>

          <FormField
            label="Nom ou raison sociale"
            error={errors.name?.message}
            required
          >
            {(c) => (
              <Input
                {...c}
                {...register('name')}
                placeholder="Ex. : Société ABC"
              />
            )}
          </FormField>

          <FormField
            label="Numéro fiscal"
            error={errors.tax_id?.message}
            hint="Renseignez le numéro fiscal si celui-ci est disponible."
          >
            {(c) => (
              <Input
                {...c}
                {...register('tax_id')}
                placeholder="Numéro d'identification fiscale"
              />
            )}
          </FormField>
        </section>

        <div className="border-t border-line" />

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Coordonnées
            </h3>
            <p className="mt-1 text-xs text-muted">
              Informations permettant de contacter ce partenaire.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Adresse e-mail"
              error={errors.email?.message}
            >
              {(c) => (
                <Input
                  type="email"
                  {...c}
                  {...register('email')}
                  placeholder="contact@exemple.com"
                />
              )}
            </FormField>

            <FormField
              label="Téléphone"
              error={errors.phone?.message}
            >
              {(c) => (
                <Input
                  type="tel"
                  {...c}
                  {...register('phone')}
                  placeholder="Numéro de téléphone"
                />
              )}
            </FormField>
          </div>

          <FormField
            label="Adresse"
            error={errors.address?.message}
          >
            {(c) => (
              <Textarea
                {...c}
                {...register('address')}
                placeholder="Adresse complète du partenaire..."
              />
            )}
          </FormField>
        </section>

        <div className="border-t border-line" />

        <section className="rounded-xl border border-line bg-surface-subtle p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">
            Statut du partenaire
          </h3>
          <Checkbox
            label="Partenaire actif"
            {...register('is_active')}
          />
          <p className="mt-2 text-xs text-muted">
            Un partenaire inactif reste enregistré, mais ne doit plus être
            utilisé pour de nouvelles opérations nécessitant un partenaire actif.
          </p>
        </section>
      </form>
    </Modal>
  )
}