import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { emptyToNull, normalizeMoney, positiveMoney } from '@/lib/validation'
import { formatDate, formatMoney, todayIso } from '@/lib/utils'
import { accountsApi } from '@/features/accounts/api'
import { suppliersApi } from '@/features/partners/api'
import { expensesApi, useExpenseActions } from '@/features/expenses/api'
import type { Expense } from '@/types/api'

const schema = z.object({
  expense_date: z.string().min(1, 'Date obligatoire.'),
  description: z.string().trim().min(1, 'Description obligatoire.').max(255),
  amount: positiveMoney(),
  account_id: z.string().min(1, 'Choisissez le compte de charge.'),
  paid_from_account_id: z.string().min(1, 'Choisissez le compte de paiement.'),
  partner_id: z.string(),
  reference: z.string().max(100),
})
type Values = z.infer<typeof schema>
const empty: Values = {
  expense_date: todayIso(),
  description: '',
  amount: '',
  account_id: '',
  paid_from_account_id: '',
  partner_id: '',
  reference: '',
}

export function ExpensesPage() {
  const { can } = useAuth()
  const toast = useToast()
  const list = useListParams()
  const query = expensesApi.useList({ ...list.params, per_page: 25 })
  const actions = useExpenseActions()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [posting, setPosting] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPosting(null)
      setDeleting(null)
    }
  }

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'Date', cell: (e) => formatDate(e.expense_date) },
    { key: 'desc', header: 'Description', cell: (e) => e.description },
    {
      key: 'account',
      header: 'Compte de charge',
      cell: (e) => (e.account ? `${e.account.code} — ${e.account.name}` : '—'),
    },
    { key: 'partner', header: 'Fournisseur', cell: (e) => e.partner?.name ?? '—' },
    { key: 'amount', header: 'Montant', align: 'right', cell: (e) => formatMoney(e.amount) },
    {
      key: 'status',
      header: 'Statut',
      cell: (e) => (
        <Badge tone={e.status === 'posted' ? 'success' : 'neutral'}>
          {e.status === 'posted' ? 'Validée' : 'Brouillon'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (e) =>
        e.status === 'draft' ? (
          <div className="flex justify-end gap-1">
            {can('expenses.update') && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Modifier la dépense ${e.description}`}
                onClick={() => setEditing(e)}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            )}
            {can('expenses.update') && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Supprimer la dépense ${e.description}`}
                onClick={() => setDeleting(e)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
            {can('expenses.validate') && (
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                onClick={() => setPosting(e)}
              >
                Valider
              </Button>
            )}
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Une dépense validée génère l'écriture : débit du compte de charge, crédit du compte de paiement."
        actions={
          can('expenses.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              Nouvelle dépense
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(v) => list.setFilter('search', v)}
            placeholder="Description"
          />
          <Select
            aria-label="Filtrer par statut"
            className="sm:w-48"
            value={list.filters.status ?? ''}
            onChange={(e) => list.setFilter('status', e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="posted">Validée</option>
          </Select>
        </div>
        <DataTable
          caption="Liste des dépenses"
          columns={columns}
          rows={query.data?.data}
          rowKey={(e) => e.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucune dépense"
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <ExpenseModal expense={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={posting !== null}
        title="Valider la dépense"
        message="L'écriture comptable est générée et la dépense ne sera plus modifiable."
        confirmLabel="Valider"
        loading={actions.post.isPending}
        onCancel={() => setPosting(null)}
        onConfirm={() =>
          posting && void run(() => actions.post.mutateAsync(posting.id), 'Dépense validée.')
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer le brouillon"
        message="Cette dépense brouillon sera définitivement supprimée."
        confirmLabel="Supprimer"
        danger
        loading={actions.remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && void run(() => actions.remove.mutateAsync(deleting.id), 'Brouillon supprimé.')
        }
      />
    </>
  )
}

function ExpenseModal(props: ComponentProps<typeof ExpenseModalBody>) {
  return props.expense === null ? null : <ExpenseModalBody {...props} />
}

function ExpenseModalBody({
  expense,
  onClose,
}: {
  expense: Expense | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = expensesApi.useCreate()
  const update = expensesApi.useUpdate()
  const accounts = accountsApi.useOptions({ is_active: 1 })
  const suppliers = suppliersApi.useOptions({ is_active: 1 })
  const [formError, setFormError] = useState<string | null>(null)
  const editing = expense !== null && expense !== 'new' ? expense : null
  const chargeAccounts = (accounts.data ?? []).filter((a) => a.type === 'expense')
  const payAccounts = (accounts.data ?? []).filter(
    (a) => a.category === 'bank' || a.category === 'cash' || a.category === 'payable',
  )

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          expense_date: editing.expense_date,
          description: editing.description,
          amount: editing.amount,
          account_id: String(editing.account_id),
          paid_from_account_id: String(editing.paid_from_account_id),
          partner_id: editing.partner_id ? String(editing.partner_id) : '',
          reference: editing.reference ?? '',
        }
      : { ...empty, expense_date: todayIso() },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      expense_date: values.expense_date,
      description: values.description,
      amount: normalizeMoney(values.amount),
      account_id: Number(values.account_id),
      paid_from_account_id: Number(values.paid_from_account_id),
      partner_id: values.partner_id ? Number(values.partner_id) : null,
      reference: emptyToNull(values.reference),
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success('Brouillon enregistré.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={expense !== null}
      onClose={onClose}
      title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="expense-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" error={errors.expense_date?.message} required>
            {(c) => <DatePicker {...c} {...register('expense_date')} />}
          </FormField>
          <FormField label="Montant" error={errors.amount?.message} required>
            {(c) => (
              <Input
                inputMode="decimal"
                className="text-right tabular"
                {...c}
                {...register('amount')}
              />
            )}
          </FormField>
        </div>
        <FormField label="Description" error={errors.description?.message} required>
          {(c) => <Input {...c} {...register('description')} />}
        </FormField>
        <FormField label="Compte de charge" error={errors.account_id?.message} required>
          {(c) => (
            <Select {...c} {...register('account_id')}>
              <option value="">Sélectionner…</option>
              {chargeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Payée depuis"
          error={errors.paid_from_account_id?.message}
          required
          hint="Banque, caisse ou fournisseurs (dépense à payer)."
        >
          {(c) => (
            <Select {...c} {...register('paid_from_account_id')}>
              <option value="">Sélectionner…</option>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Fournisseur" error={errors.partner_id?.message}>
          {(c) => (
            <Select {...c} {...register('partner_id')}>
              <option value="">Aucun</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Référence" error={errors.reference?.message}>
          {(c) => <Input {...c} {...register('reference')} />}
        </FormField>
      </form>
    </Modal>
  )
}
