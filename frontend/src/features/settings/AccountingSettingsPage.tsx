import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Pencil, Plus, Settings2 } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { journalTypeLabels, optionsOf } from '@/lib/labels'
import { ActiveBadge, StatusBadge } from '@/components/ui/StatusBadges'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { formatDate } from '@/lib/utils'
import { fiscalYearsApi, journalsApi } from '@/features/settings/api'
import { CompanyPanel } from '@/features/settings/CompanyPanel'
import { DefaultAccountsPanel } from '@/features/settings/DefaultAccountsPanel'
import { PaymentTermsPanel } from '@/features/settings/PaymentTermsPanel'
import { TaxesPanel } from '@/features/settings/TaxesPanel'
import type { FiscalYear, Journal } from '@/types/api'

export function AccountingSettingsPage() {
  const [tab, setTab] = useState('general')
  return (
    <>
      <PageHeader
        title="Paramètres comptables"
        description="Configurez la société, les taxes, les comptes par défaut, les journaux et les exercices."
      />
      <Card padded={false} className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Settings2 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Configuration de la comptabilité</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Ces réglages s'appliquent à toute l'entreprise : ils pilotent la facturation, la
              numérotation des pièces et la comptabilisation automatique.
            </p>
          </div>
        </div>
      </Card>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'general', label: 'Général', content: <CompanyPanel /> },
          { id: 'taxes', label: 'Taxes', content: <TaxesPanel /> },
          { id: 'defaults', label: 'Comptes par défaut', content: <DefaultAccountsPanel /> },
          { id: 'terms', label: 'Conditions de paiement', content: <PaymentTermsPanel /> },
          { id: 'journals', label: 'Journaux', content: <JournalsPanel /> },
          { id: 'fiscal', label: 'Exercices', content: <FiscalYearsPanel /> },
        ]}
      />
    </>
  )
}

/* ------------------------------ Journaux ------------------------------ */

const journalSchema = z.object({
  code: z.string().trim().min(1, 'Le code est obligatoire.').max(10, '10 caractères maximum.'),
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(255),
  type: z.enum(['sales', 'purchases', 'bank', 'cash', 'general']),
  next_number: z
    .number({ error: 'Numéro invalide.' })
    .int('Nombre entier requis.')
    .min(1, 'Le numéro doit être au moins 1.'),
  is_active: z.boolean(),
})
type JournalValues = z.infer<typeof journalSchema>

/** Référence de la prochaine pièce d'un journal (même format que le serveur : CODE-000001). */
function nextReference(code: string, next: number): string {
  return `${code}-${String(next).padStart(6, '0')}`
}

function JournalsPanel() {
  const { can } = useAuth()
  const query = journalsApi.useList({ per_page: 100 })
  const [editing, setEditing] = useState<Journal | 'new' | null>(null)

  const columns: Column<Journal>[] = [
    { key: 'code', header: 'Code', cell: (j) => <span className="font-mono">{j.code}</span> },
    { key: 'name', header: 'Nom', cell: (j) => j.name },
    { key: 'type', header: 'Type', cell: (j) => journalTypeLabels[j.type] },
    {
      key: 'next',
      header: 'Prochaine pièce',
      cell: (j) => (
        <span className="font-mono text-ink-muted">{nextReference(j.code, j.next_number)}</span>
      ),
    },
    { key: 'status', header: 'Statut', cell: (j) => <ActiveBadge active={j.is_active} /> },
    ...(can('journals.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (j: Journal) => (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setEditing(j)}
                aria-label={`Modifier le journal ${j.code}`}
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
      title="Journaux"
      padded={false}
      actions={
        can('journals.create') && (
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setEditing('new')}
          >
            Nouveau journal
          </Button>
        )
      }
    >
      <DataTable
        caption="Liste des journaux"
        columns={columns}
        rows={query.data?.data}
        rowKey={(j) => j.id}
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
      />
      <JournalModal journal={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

function JournalModal(props: ComponentProps<typeof JournalModalBody>) {
  return props.journal === null ? null : <JournalModalBody {...props} />
}

function JournalModalBody({
  journal,
  onClose,
}: {
  journal: Journal | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = journalsApi.useCreate()
  const update = journalsApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = journal !== null && journal !== 'new' ? journal : null
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JournalValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type,
          next_number: editing.next_number,
          is_active: editing.is_active,
        }
      : { code: '', name: '', type: 'general', next_number: 1, is_active: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values })
      else await create.mutateAsync(values)
      toast.success('Journal enregistré.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={journal !== null}
      onClose={onClose}
      title={editing ? 'Modifier le journal' : 'Nouveau journal'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="journal-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="journal-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Code" error={errors.code?.message} required>
          {(c) => <Input {...c} {...register('code')} />}
        </FormField>
        <FormField label="Nom" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Type" error={errors.type?.message} required>
          {(c) => (
            <Select {...c} {...register('type')}>
              {optionsOf(journalTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Prochain numéro de pièce"
          hint={`Prochaine référence : ${nextReference(
            watch('code') || 'CODE',
            Number(watch('next_number')) || 1,
          )}. Le numéro peut seulement avancer.`}
          error={errors.next_number?.message}
          required
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              min={editing?.next_number ?? 1}
              {...register('next_number', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <Checkbox label="Journal actif" {...register('is_active')} />
      </form>
    </Modal>
  )
}

/* ------------------------------ Exercices ------------------------------ */

const fiscalSchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est obligatoire.').max(100),
    starts_on: z.string().min(1, 'Date de début obligatoire.'),
    ends_on: z.string().min(1, 'Date de fin obligatoire.'),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on > v.starts_on, {
    message: 'La fin doit être postérieure au début.',
    path: ['ends_on'],
  })
type FiscalValues = z.infer<typeof fiscalSchema>

function FiscalYearsPanel() {
  const { can } = useAuth()
  const toast = useToast()
  const query = fiscalYearsApi.useList({ per_page: 100 })
  const update = fiscalYearsApi.useUpdate()
  const [editing, setEditing] = useState<FiscalYear | 'new' | null>(null)
  const [closing, setClosing] = useState<FiscalYear | null>(null)

  const closeYear = async () => {
    if (!closing) return
    try {
      await update.mutateAsync({
        id: closing.id,
        input: {
          name: closing.name,
          starts_on: closing.starts_on,
          ends_on: closing.ends_on,
          status: 'closed',
        },
      })
      toast.success('Exercice clôturé.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setClosing(null)
    }
  }

  const columns: Column<FiscalYear>[] = [
    { key: 'name', header: 'Exercice', cell: (f) => <span className="font-medium">{f.name}</span> },
    { key: 'from', header: 'Début', cell: (f) => formatDate(f.starts_on) },
    { key: 'to', header: 'Fin', cell: (f) => formatDate(f.ends_on) },
    {
      key: 'status',
      header: 'Statut',
      cell: (f) => (
        <StatusBadge
          status={f.status === 'open' ? 'validated' : 'draft'}
          label={f.status === 'open' ? 'Ouvert' : 'Clôturé'}
        />
      ),
    },
    ...(can('fiscal_years.update')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (f: FiscalYear) =>
              f.status === 'open' ? (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="size-4" aria-hidden="true" />}
                    onClick={() => setEditing(f)}
                    aria-label={`Modifier l'exercice ${f.name}`}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Lock className="size-4" aria-hidden="true" />}
                    onClick={() => setClosing(f)}
                    aria-label={`Clôturer l'exercice ${f.name}`}
                  >
                    Clôturer
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <Card
      title="Exercices comptables"
      padded={false}
      actions={
        can('fiscal_years.create') && (
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setEditing('new')}
          >
            Nouvel exercice
          </Button>
        )
      }
    >
      <DataTable
        caption="Liste des exercices"
        columns={columns}
        rows={query.data?.data}
        rowKey={(f) => f.id}
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucun exercice"
        emptyDescription="Créez un exercice pour pouvoir valider des écritures."
      />
      <FiscalYearModal year={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={closing !== null}
        title="Clôturer l'exercice"
        message="Après la clôture, aucune écriture ne pourra plus être validée sur cette période. Aucune écriture de clôture n'est générée automatiquement."
        confirmLabel="Clôturer"
        danger
        loading={update.isPending}
        onCancel={() => setClosing(null)}
        onConfirm={() => void closeYear()}
      />
    </Card>
  )
}

function FiscalYearModal(props: ComponentProps<typeof FiscalYearModalBody>) {
  return props.year === null ? null : <FiscalYearModalBody {...props} />
}

function FiscalYearModalBody({
  year,
  onClose,
}: {
  year: FiscalYear | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = fiscalYearsApi.useCreate()
  const update = fiscalYearsApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = year !== null && year !== 'new' ? year : null
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FiscalValues>({
    resolver: zodResolver(fiscalSchema),
    defaultValues: editing
      ? { name: editing.name, starts_on: editing.starts_on, ends_on: editing.ends_on }
      : { name: '', starts_on: '', ends_on: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      if (editing)
        await update.mutateAsync({ id: editing.id, input: { ...values, status: editing.status } })
      else await create.mutateAsync({ ...values, status: 'open' })
      toast.success('Exercice enregistré.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={year !== null}
      onClose={onClose}
      title={editing ? "Modifier l'exercice" : 'Nouvel exercice'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="fiscal-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="fiscal-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Début" error={errors.starts_on?.message} required>
          {(c) => <DatePicker {...c} {...register('starts_on')} />}
        </FormField>
        <FormField label="Fin" error={errors.ends_on?.message} required>
          {(c) => <DatePicker {...c} {...register('ends_on')} />}
        </FormField>
      </form>
    </Modal>
  )
}
