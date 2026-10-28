import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { emptyToNull } from '@/lib/validation'
import { formatDate } from '@/lib/utils'
import { companiesApi } from '@/features/administration/api'
import type { Company } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(255),
  legal_name: z.string().max(255),
  tax_id: z.string().max(50),
  email: z.union([z.literal(''), z.string().trim().email("Format d'e-mail invalide.")]),
  phone: z.string().max(40),
  address: z.string().max(1000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Code ISO à 3 lettres (ex. MGA).'),
  locale: z.enum(['fr', 'en']),
  status: z.enum(['active', 'suspended']),
})
type Values = z.infer<typeof schema>
const empty: Values = {
  name: '',
  legal_name: '',
  tax_id: '',
  email: '',
  phone: '',
  address: '',
  currency: 'MGA',
  locale: 'fr',
  status: 'active',
}

export function CompaniesPage() {
  const { can } = useAuth()
  const list = useListParams()
  const query = companiesApi.useList({ ...list.params, per_page: 25 })
  const [editing, setEditing] = useState<Company | 'new' | null>(null)

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Entreprise',
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    { key: 'tax', header: 'N° fiscal', cell: (c) => c.tax_id ?? '—' },
    { key: 'currency', header: 'Devise', cell: (c) => c.currency },
    { key: 'users', header: 'Utilisateurs', align: 'right', cell: (c) => c.users_count ?? 0 },
    {
      key: 'status',
      header: 'Statut',
      cell: (c) => (
        <Badge tone={c.status === 'active' ? 'success' : 'warning'}>
          {c.status === 'active' ? 'Active' : 'Suspendue'}
        </Badge>
      ),
    },
    { key: 'created', header: 'Créée le', cell: (c) => formatDate(c.created_at) },
    ...(can('companies.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (c: Company) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(c)}
                aria-label={`Modifier ${c.name}`}
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
        title="Entreprises"
        description="Chaque entreprise dispose de données comptables strictement isolées."
        actions={
          can('companies.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              Nouvelle entreprise
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="border-b border-line p-4">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(v) => list.setFilter('search', v)}
            placeholder="Nom de l'entreprise"
          />
        </div>
        <DataTable
          caption="Liste des entreprises"
          columns={columns}
          rows={query.data?.data}
          rowKey={(c) => c.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucune entreprise"
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <CompanyModal company={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function CompanyModal(props: ComponentProps<typeof CompanyModalBody>) {
  return props.company === null ? null : <CompanyModalBody {...props} />
}

function CompanyModalBody({
  company,
  onClose,
}: {
  company: Company | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = companiesApi.useCreate()
  const update = companiesApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = company !== null && company !== 'new' ? company : null
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
          legal_name: editing.legal_name ?? '',
          tax_id: editing.tax_id ?? '',
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          address: editing.address ?? '',
          currency: editing.currency,
          locale: editing.locale as 'fr' | 'en',
          status: editing.status,
        }
      : empty,
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      name: values.name,
      legal_name: emptyToNull(values.legal_name),
      tax_id: emptyToNull(values.tax_id),
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      address: emptyToNull(values.address),
      currency: values.currency,
      locale: values.locale,
      status: values.status,
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success(editing ? 'Entreprise mise à jour.' : 'Entreprise créée.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={company !== null}
      onClose={onClose}
      title={editing ? "Modifier l'entreprise" : 'Nouvelle entreprise'}
      description={
        editing
          ? undefined
          : 'Le plan comptable simplifié, les journaux et l’exercice courant sont créés automatiquement.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="company-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="company-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom commercial" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Raison sociale" error={errors.legal_name?.message}>
            {(c) => <Input {...c} {...register('legal_name')} />}
          </FormField>
          <FormField label="Numéro fiscal" error={errors.tax_id?.message}>
            {(c) => <Input {...c} {...register('tax_id')} />}
          </FormField>
          <FormField label="E-mail" error={errors.email?.message}>
            {(c) => <Input type="email" {...c} {...register('email')} />}
          </FormField>
          <FormField label="Téléphone" error={errors.phone?.message}>
            {(c) => <Input type="tel" {...c} {...register('phone')} />}
          </FormField>
        </div>
        <FormField label="Adresse" error={errors.address?.message}>
          {(c) => <Textarea {...c} {...register('address')} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Devise" error={errors.currency?.message} required>
            {(c) => <Input maxLength={3} {...c} {...register('currency')} />}
          </FormField>
          <FormField label="Langue" error={errors.locale?.message} required>
            {(c) => (
              <Select {...c} {...register('locale')}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            )}
          </FormField>
          <FormField label="Statut" error={errors.status?.message} required>
            {(c) => (
              <Select {...c} {...register('status')}>
                <option value="active">Active</option>
                <option value="suspended">Suspendue</option>
              </Select>
            )}
          </FormField>
        </div>
      </form>
    </Modal>
  )
}
