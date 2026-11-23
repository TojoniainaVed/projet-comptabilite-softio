import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { ActiveBadge } from '@/components/ui/StatusBadges'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { paymentTermsApi } from '@/features/settings/api'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import type { PaymentTerm } from '@/types/api'

function describeTerm(term: Pick<PaymentTerm, 'days' | 'end_of_month'>): string {
  if (term.days === 0 && !term.end_of_month) return 'Paiement immédiat'
  const days = `${term.days} jour${term.days > 1 ? 's' : ''}`
  return term.end_of_month ? `${days}, puis fin du mois` : `${days} après la date de facture`
}

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(100, '100 caractères maximum.'),
  days: z
    .number({ error: 'Délai invalide.' })
    .int('Nombre de jours entier requis.')
    .min(0, 'Le délai ne peut pas être négatif.')
    .max(365, '365 jours maximum.'),
  end_of_month: z.boolean(),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

/** Onglet « Conditions de paiement » : délais proposés pour calculer l'échéance d'une facture. */
export function PaymentTermsPanel() {
  const { can } = useAuth()
  const query = paymentTermsApi.useList({ per_page: 100 })
  const [editing, setEditing] = useState<PaymentTerm | 'new' | null>(null)

  const columns: Column<PaymentTerm>[] = [
    { key: 'name', header: 'Nom', cell: (t) => <span className="font-medium">{t.name}</span> },
    { key: 'rule', header: 'Règle de calcul', cell: (t) => describeTerm(t) },
    { key: 'status', header: 'Statut', cell: (t) => <ActiveBadge active={t.is_active} /> },
    ...(can('accounts.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (t: PaymentTerm) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(t)}
                aria-label={`Modifier la condition ${t.name}`}
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
      title="Conditions de paiement"
      padded={false}
      actions={
        can('accounts.create') && (
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setEditing('new')}
          >
            Nouvelle condition
          </Button>
        )
      }
    >
      <p className="border-b border-line px-4 py-3 text-sm text-ink-muted">
        Une condition de paiement définit la date d'échéance d'une facture à partir de sa date
        d'émission.
      </p>
      <DataTable
        caption="Liste des conditions de paiement"
        columns={columns}
        rows={query.data?.data}
        rowKey={(t) => t.id}
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucune condition de paiement"
        emptyDescription="Créez par exemple « 30 jours »."
      />
      <TermModal term={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function TermModal(props: ComponentProps<typeof TermModalBody>) {
  return props.term === null ? null : <TermModalBody {...props} />
}

function TermModalBody({
  term,
  onClose,
}: {
  term: PaymentTerm | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = paymentTermsApi.useCreate()
  const update = paymentTermsApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = term !== null && term !== 'new' ? term : null
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
          days: editing.days,
          end_of_month: editing.end_of_month,
          is_active: editing.is_active,
        }
      : { name: '', days: 30, end_of_month: false, is_active: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values })
      else await create.mutateAsync(values)
      toast.success('Condition de paiement enregistrée.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={term !== null}
      onClose={onClose}
      title={editing ? 'Modifier la condition' : 'Nouvelle condition de paiement'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="term-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="term-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Délai (jours)" error={errors.days?.message} required>
          {(c) => (
            <Input
              {...c}
              type="number"
              min={0}
              max={365}
              {...register('days', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <Checkbox label="Reporter à la fin du mois" {...register('end_of_month')} />
        <Checkbox label="Condition active" {...register('is_active')} />
      </form>
    </Modal>
  )
}
