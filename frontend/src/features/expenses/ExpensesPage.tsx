import { useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
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
import { cn, formatDate, formatMoney, todayIso } from '@/lib/utils'
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

// Mêmes styles que les boutons, pour les liens de navigation de l'en-tête.
const linkButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

function AccountCell({ account }: { account?: { code: string; name: string } | null }) {
  if (!account) return <>—</>
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-ink">{account.name}</p>
      <p className="font-mono text-xs text-ink-muted">{account.code}</p>
    </div>
  )
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
  const [resetKey, setResetKey] = useState(0)

  // Compteurs par statut sur la même période et la même recherche que la liste.
  const period = { from: list.filters.from, to: list.filters.to, search: list.filters.search }
  const drafts = expensesApi.useList({ ...period, status: 'draft', per_page: 1 })
  const posted = expensesApi.useList({ ...period, status: 'posted', per_page: 1 })

  const rows = query.data?.data
  const pageTotal = (rows ?? []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const count = (q: typeof query) =>
    q.data?.meta ? q.data.meta.total.toLocaleString('fr-FR') : q.isError ? '—' : '…'

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

  const resetFilters = () => {
    for (const key of ['search', 'status', 'from', 'to']) list.setFilter(key, '')
    setResetKey((k) => k + 1) // vide aussi le texte saisi dans la recherche
  }
  const hasFilters = ['search', 'status', 'from', 'to'].some((key) => list.filters[key])

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (e) => (
        <span className="whitespace-nowrap font-medium">{formatDate(e.expense_date)}</span>
      ),
    },
    {
      key: 'desc',
      header: 'Description',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{e.description}</p>
          {e.reference && <p className="text-xs text-ink-muted">Réf. {e.reference}</p>}
        </div>
      ),
    },
    { key: 'partner', header: 'Fournisseur', cell: (e) => e.partner?.name ?? '—' },
    {
      key: 'account',
      header: 'Compte de charge',
      cell: (e) => <AccountCell account={e.account} />,
    },
    {
      key: 'paid_from',
      header: 'Payée depuis',
      cell: (e) => <AccountCell account={e.paid_from_account} />,
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      cell: (e) => <span className="font-semibold tabular">{formatMoney(e.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (e) => (
        <Badge tone={e.status === 'posted' ? 'success' : 'warning'}>
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
        ) : e.journal_entry_id && can('entries.view') ? (
          <Link
            to={`/journal-entries/${e.journal_entry_id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-canvas"
          >
            Écriture
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null,
    },
  ]

  return (
    <div className="motion-safe:animate-fade-in">
      <PageHeader
        title="Dépenses"
        description="Charges réglées directement, sans facture fournisseur : frais, petites fournitures, abonnements…"
        actions={
          <>
            {can('reports.view') && (
              <Link to="/treasury" className={linkButton}>
                <Landmark className="size-4" aria-hidden="true" />
                Trésorerie
              </Link>
            )}
            {can('expenses.create') && (
              <Button
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setEditing('new')}
              >
                Nouvelle dépense
              </Button>
            )}
          </>
        }
      />

      {/* Rôle du menu et lien avec les factures et la trésorerie */}
      <Card padded={false} className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Receipt className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Suivi des dépenses</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Une dépense validée génère son écriture : débit du compte de charge, crédit du compte
              de banque ou de caisse, ce qui met à jour la trésorerie. Pour un achat avec facture,
              passez plutôt par les{' '}
              {can('invoices.view') ? (
                <Link
                  to="/purchases/invoices"
                  className="font-medium text-brand-700 hover:underline"
                >
                  factures fournisseurs
                </Link>
              ) : (
                'factures fournisseurs'
              )}
              .
            </p>
          </div>
        </div>
      </Card>

      {/* Indicateurs */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Dépenses trouvées"
          value={count(query)}
          hint="Résultats correspondant aux filtres"
          icon={<FileText className="size-5" />}
        />
        <StatCard
          label="Brouillons à valider"
          value={count(drafts)}
          hint="Sans écriture comptable pour l'instant"
          icon={<Clock3 className="size-5" />}
        />
        <StatCard
          label="Validées"
          value={count(posted)}
          hint="Comptabilisées et répercutées en trésorerie"
          icon={<CheckCircle2 className="size-5" />}
        />
        <StatCard
          label="Montant de la page"
          value={rows ? formatMoney(pageTotal) : '…'}
          hint="Somme des dépenses affichées"
          icon={<Wallet className="size-5" />}
        />
      </div>

      {/* Filtres */}
      <Card
        title="Filtres et période"
        actions={
          hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Réinitialiser
            </button>
          )
        }
        padded={false}
        className="mb-5"
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink-muted" aria-hidden="true">
              Recherche
            </p>
            <SearchInput
              key={resetKey}
              label="Rechercher une dépense"
              value={list.filters.search ?? ''}
              onChange={(v) => list.setFilter('search', v)}
              placeholder="Description"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expense-status" className="text-xs font-medium text-ink-muted">
              Statut
            </label>
            <Select
              id="expense-status"
              value={list.filters.status ?? ''}
              onChange={(e) => list.setFilter('status', e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="posted">Validée</option>
            </Select>
          </div>
          {(['from', 'to'] as const).map((key) => (
            <div key={key} className="space-y-1.5">
              <label htmlFor={`expense-${key}`} className="text-xs font-medium text-ink-muted">
                {key === 'from' ? 'Date de début' : 'Date de fin'}
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <DatePicker
                  id={`expense-${key}`}
                  className="pl-9"
                  value={list.filters[key] ?? ''}
                  onChange={(e) => list.setFilter(key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Historique */}
      <Card
        title="Historique des dépenses"
        actions={
          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">
            {query.data?.meta ? `${query.data.meta.total} résultat(s)` : 'Chargement…'}
          </span>
        }
        padded={false}
      >
        {/* Pendant un changement de filtre ou de page, l'ancienne liste reste affichée en transparence. */}
        <div
          className={cn(
            'transition-opacity duration-200',
            query.isPlaceholderData && query.isFetching && 'pointer-events-none opacity-60',
          )}
        >
          <DataTable
            caption="Liste des dépenses"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            loading={query.isLoading}
            error={query.isError ? errorMessage(query.error) : null}
            onRetry={() => void query.refetch()}
            emptyTitle="Aucune dépense"
            emptyDescription={
              hasFilters
                ? 'Aucune dépense ne correspond aux filtres.'
                : 'Enregistrez votre première dépense avec « Nouvelle dépense ».'
            }
          />
        </div>
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>

      <ExpenseModal expense={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={posting !== null}
        title="Valider la dépense"
        message="L'écriture comptable est générée, la trésorerie est mise à jour et la dépense ne sera plus modifiable."
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
    </div>
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
  const treasuryAccounts = (accounts.data ?? []).filter(
    (a) => a.category === 'bank' || a.category === 'cash',
  )
  const payableAccounts = (accounts.data ?? []).filter((a) => a.category === 'payable')

  const {
    register,
    handleSubmit,
    setError,
    control,
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

  // Aperçu en direct de l'écriture qui sera générée à la validation.
  const [amount, accountId, paidFromId] = useWatch({
    control,
    name: ['amount', 'account_id', 'paid_from_account_id'],
  })
  const byId = (id: string) => accounts.data?.find((a) => String(a.id) === id)
  const debit = byId(accountId)
  const credit = byId(paidFromId)
  const previewAmount = Number(normalizeMoney(amount || '0')) || 0

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
      size="lg"
      title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
      description="Enregistrée en brouillon : l'écriture n'est générée qu'à la validation."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="expense-form" loading={isSubmitting}>
            Enregistrer le brouillon
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <InlineAlert>{formError}</InlineAlert>}

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Informations
          </legend>
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
          <div className="grid gap-4 sm:grid-cols-2">
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
            <FormField
              label="Référence"
              error={errors.reference?.message}
              hint="N° de ticket, de reçu…"
            >
              {(c) => <Input {...c} {...register('reference')} />}
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Imputation
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
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
              hint="Banque ou caisse ; compte fournisseur si elle reste à payer."
            >
              {(c) => (
                <Select {...c} {...register('paid_from_account_id')}>
                  <option value="">Sélectionner…</option>
                  <optgroup label="Trésorerie (banque, caisse)">
                    {treasuryAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </optgroup>
                  {payableAccounts.length > 0 && (
                    <optgroup label="À payer (fournisseurs)">
                      {payableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              )}
            </FormField>
          </div>

          {/* Aperçu de l'écriture */}
          <div className="overflow-hidden rounded-lg border border-line bg-canvas/60">
            <p className="border-b border-line px-3 py-2 text-xs font-medium text-ink-muted">
              Écriture générée à la validation
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th className="px-3 py-1.5 text-left font-medium">Compte</th>
                  <th className="px-3 py-1.5 text-right font-medium">Débit</th>
                  <th className="px-3 py-1.5 text-right font-medium">Crédit</th>
                </tr>
              </thead>
              <tbody className="tabular">
                <tr className="border-t border-line">
                  <td className="px-3 py-2">
                    {debit ? (
                      `${debit.code} — ${debit.name}`
                    ) : (
                      <span className="text-ink-muted">Compte de charge</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(previewAmount)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">—</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="px-3 py-2">
                    {credit ? (
                      `${credit.code} — ${credit.name}`
                    ) : (
                      <span className="text-ink-muted">Compte de paiement</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">—</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(previewAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
