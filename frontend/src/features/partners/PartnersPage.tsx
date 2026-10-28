import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
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
const empty: Values = { name: '', email: '', phone: '', tax_id: '', address: '', is_active: true }

export function PartnersPage({ kind }: { kind: 'customer' | 'supplier' }) {
  const isCustomer = kind === 'customer'
  const api = isCustomer ? customersApi : suppliersApi
  const noun = isCustomer ? 'client' : 'fournisseur'
  const { can } = useAuth()
  const list = useListParams()
  const query = api.useList({ ...list.params, per_page: 25 })
  const [editing, setEditing] = useState<Partner | 'new' | null>(null)

  const columns: Column<Partner>[] = [
    { key: 'name', header: 'Nom', cell: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'email', header: 'E-mail', cell: (p) => p.email ?? '—' },
    { key: 'phone', header: 'Téléphone', cell: (p) => p.phone ?? '—' },
    { key: 'tax', header: 'N° fiscal', cell: (p) => p.tax_id ?? '—' },
    { key: 'status', header: 'Statut', cell: (p) => <ActiveBadge active={p.is_active} /> },
    ...(can('partners.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (p: Partner) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(p)}
                aria-label={`Modifier ${p.name}`}
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
        title={isCustomer ? 'Clients' : 'Fournisseurs'}
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
      <Card padded={false}>
        <div className="border-b border-line p-4">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(value) => list.setFilter('search', value)}
            placeholder="Nom, e-mail…"
          />
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
          emptyDescription={`Ajoutez votre premier ${noun} pour pouvoir saisir des factures.`}
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <PartnerFormModal kind={kind} partner={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function PartnerFormModal(props: ComponentProps<typeof PartnerFormModalBody>) {
  return props.partner === null ? null : <PartnerFormModalBody {...props} />
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
  const editing = partner !== null && partner !== 'new' ? partner : null
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
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success('Enregistré.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={partner !== null}
      onClose={onClose}
      title={editing ? 'Modifier' : kind === 'customer' ? 'Nouveau client' : 'Nouveau fournisseur'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="partner-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="partner-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="E-mail" error={errors.email?.message}>
            {(c) => <Input type="email" {...c} {...register('email')} />}
          </FormField>
          <FormField label="Téléphone" error={errors.phone?.message}>
            {(c) => <Input type="tel" {...c} {...register('phone')} />}
          </FormField>
        </div>
        <FormField label="Numéro fiscal" error={errors.tax_id?.message}>
          {(c) => <Input {...c} {...register('tax_id')} />}
        </FormField>
        <FormField label="Adresse" error={errors.address?.message}>
          {(c) => <Textarea {...c} {...register('address')} />}
        </FormField>
        <Checkbox label="Actif" {...register('is_active')} />
      </form>
    </Modal>
  )
}
