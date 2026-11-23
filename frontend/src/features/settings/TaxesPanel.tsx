import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { ActiveBadge } from '@/components/ui/StatusBadges'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { taxesApi } from '@/features/settings/api'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { formatNumber } from '@/lib/utils'
import type { Tax } from '@/types/api'

const scopeLabels: Record<Tax['scope'], string> = {
  sales: 'Ventes',
  purchases: 'Achats',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(100, '100 caractères maximum.'),
  rate: z
    .string()
    .trim()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Taux invalide (ex. 20 ou 5,5).')
    .refine((v) => Number(v.replace(',', '.')) <= 100, 'Le taux ne peut pas dépasser 100 %.'),
  scope: z.enum(['sales', 'purchases']),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

/** Onglet « Taxes » : taux de TVA proposés à la saisie des factures. */
export function TaxesPanel() {
  const { can } = useAuth()
  const query = taxesApi.useList({ per_page: 100 })
  const [editing, setEditing] = useState<Tax | 'new' | null>(null)

  const columns: Column<Tax>[] = [
    {
      key: 'name',
      header: 'Nom de la taxe',
      cell: (t) => <span className="font-medium">{t.name}</span>,
    },
    {
      key: 'rate',
      header: 'Taux',
      align: 'right',
      cell: (t) => <span className="tabular">{formatNumber(t.rate)} %</span>,
    },
    {
      key: 'scope',
      header: 'Utilisée pour',
      cell: (t) => (
        <Badge tone={t.scope === 'sales' ? 'info' : 'neutral'}>{scopeLabels[t.scope]}</Badge>
      ),
    },
    { key: 'status', header: 'Statut', cell: (t) => <ActiveBadge active={t.is_active} /> },
    ...(can('accounts.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (t: Tax) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(t)}
                aria-label={`Modifier la taxe ${t.name}`}
              >
                Modifier
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <Card
      title="Taxes"
      padded={false}
      actions={
        can('accounts.create') && (
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setEditing('new')}
          >
            Nouvelle taxe
          </Button>
        )
      }
    >
      <p className="border-b border-line px-4 py-3 text-sm text-ink-muted">
        La TVA collectée (ventes) et la TVA déductible (achats) sont comptabilisées sur les comptes
        définis dans « Comptes par défaut ».
      </p>
      <DataTable
        caption="Liste des taxes"
        columns={columns}
        rows={query.data?.data}
        rowKey={(t) => t.id}
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucune taxe"
        emptyDescription="Créez par exemple une TVA à 20 % pour vos ventes."
      />
      <TaxModal tax={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function TaxModal(props: ComponentProps<typeof TaxModalBody>) {
  return props.tax === null ? null : <TaxModalBody {...props} />
}

function TaxModalBody({ tax, onClose }: { tax: Tax | 'new' | null; onClose: () => void }) {
  const toast = useToast()
  const create = taxesApi.useCreate()
  const update = taxesApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = tax !== null && tax !== 'new' ? tax : null
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
          rate: String(Number(editing.rate)),
          scope: editing.scope,
          is_active: editing.is_active,
        }
      : { name: '', rate: '20', scope: 'sales', is_active: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = { ...values, rate: values.rate.replace(',', '.') }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success('Taxe enregistrée.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={tax !== null}
      onClose={onClose}
      title={editing ? 'Modifier la taxe' : 'Nouvelle taxe'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="tax-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="tax-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom de la taxe" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Taux (%)" error={errors.rate?.message} required>
          {(c) => <Input {...c} inputMode="decimal" {...register('rate')} />}
        </FormField>
        <FormField label="Utilisée pour" error={errors.scope?.message} required>
          {(c) => (
            <Select {...c} {...register('scope')}>
              <option value="sales">{scopeLabels.sales}</option>
              <option value="purchases">{scopeLabels.purchases}</option>
            </Select>
          )}
        </FormField>
        <Checkbox label="Taxe active" {...register('is_active')} />
      </form>
    </Modal>
  )
}
