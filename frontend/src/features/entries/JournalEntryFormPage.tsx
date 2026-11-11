import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { normalizeOptionalMoney, optionalMoney } from '@/lib/validation'
import { formatNumber, todayIso } from '@/lib/utils'
import { accountsApi } from '@/features/accounts/api'
import { journalsApi } from '@/features/settings/api'
import { computeEntryTotals } from '@/features/entries/balance'
import { entriesApi } from '@/features/entries/api'

const lineSchema = z
  .object({
    account_id: z.string().min(1, 'Choisissez un compte.'),
    label: z.string().max(255),
    debit: optionalMoney(),
    credit: optionalMoney(),
  })
  .refine(
    (line) =>
      !(Number(line.debit.replace(',', '.')) > 0 && Number(line.credit.replace(',', '.')) > 0),
    {
      message: 'Une ligne ne peut pas être à la fois au débit et au crédit.',
      path: ['credit'],
    },
  )

const schema = z.object({
  journal_id: z.string().min(1, 'Choisissez un journal.'),
  entry_date: z.string().min(1, 'La date est obligatoire.'),
  description: z.string().trim().min(1, 'Le libellé est obligatoire.').max(255),
  lines: z.array(lineSchema).min(2, 'Une écriture comporte au moins deux lignes.'),
})
type Values = z.infer<typeof schema>

const blankLine = { account_id: '', label: '', debit: '', credit: '' }

export function JournalEntryFormPage() {
  const { id } = useParams()
  const entryId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const toast = useToast()
  const existing = entriesApi.useOne(entryId)
  const accounts = accountsApi.useOptions({ is_active: 1 })
  const journals = journalsApi.useOptions({ is_active: 1 })
  const create = entriesApi.useCreate()
  const update = entriesApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      journal_id: '',
      entry_date: todayIso(),
      description: '',
      lines: [blankLine, blankLine],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watched = useWatch({ control, name: 'lines' })
  const totals = computeEntryTotals(watched ?? [])

  useEffect(() => {
    const entry = existing.data
    if (!entry) return
    reset({
      journal_id: String(entry.journal?.id ?? ''),
      entry_date: entry.entry_date,
      description: entry.description,
      lines: (entry.lines ?? []).map((line) => ({
        account_id: String(line.account_id),
        label: line.label ?? '',
        debit: Number(line.debit) > 0 ? line.debit : '',
        credit: Number(line.credit) > 0 ? line.credit : '',
      })),
    })
  }, [existing.data, reset])

  if (entryId !== undefined && existing.isLoading) return <LoadingSpinner />
  if (entryId !== undefined && existing.isError)
    return <ErrorState message={errorMessage(existing.error)} />
  if (existing.data && existing.data.status !== 'draft') {
    return <InlineAlert>Seule une écriture brouillon peut être modifiée.</InlineAlert>
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      journal_id: Number(values.journal_id),
      entry_date: values.entry_date,
      description: values.description,
      lines: values.lines.map((line) => ({
        account_id: Number(line.account_id),
        label: line.label.trim() === '' ? null : line.label.trim(),
        debit: normalizeOptionalMoney(line.debit),
        credit: normalizeOptionalMoney(line.credit),
      })),
    }
    try {
      const result = entryId
        ? await update.mutateAsync({ id: entryId, input })
        : await create.mutateAsync(input)
      toast.success('Brouillon enregistré.')
      navigate(`/journal-entries/${result.data.id}`)
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <>
      <PageHeader
        title={entryId ? "Modifier l'écriture" : 'Nouvelle écriture'}
        breadcrumbs={[
          { label: 'Écritures', to: '/journal-entries' },
          { label: entryId ? 'Modifier' : 'Nouvelle' },
        ]}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <Card>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Journal" error={errors.journal_id?.message} required>
              {(c) => (
                <Select {...c} {...register('journal_id')}>
                  <option value="">Sélectionner…</option>
                  {journals.data?.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} — {j.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Date" error={errors.entry_date?.message} required>
              {(c) => <DatePicker {...c} {...register('entry_date')} />}
            </FormField>
            <FormField
              label="Libellé"
              error={errors.description?.message}
              required
              className="md:col-span-1"
            >
              {(c) => <Input {...c} {...register('description')} />}
            </FormField>
          </div>
        </Card>

        <Card title="Lignes" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Lignes de l'écriture</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2">
                    Compte
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Libellé
                  </th>
                  <th scope="col" className="w-36 px-2 py-2">
                    Débit
                  </th>
                  <th scope="col" className="w-36 px-2 py-2">
                    Crédit
                  </th>
                  <th scope="col" className="w-12 px-2 py-2">
                    <span className="sr-only">Supprimer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-line align-top">
                    <td className="px-4 py-2">
                      <Select
                        aria-label={`Compte, ligne ${index + 1}`}
                        aria-invalid={errors.lines?.[index]?.account_id ? true : undefined}
                        {...register(`lines.${index}.account_id`)}
                      >
                        <option value="">Sélectionner…</option>
                        {accounts.data?.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </Select>
                      {errors.lines?.[index]?.account_id && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                          {errors.lines[index]?.account_id?.message}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Libellé, ligne ${index + 1}`}
                        {...register(`lines.${index}.label`)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        aria-label={`Débit, ligne ${index + 1}`}
                        aria-invalid={errors.lines?.[index]?.debit ? true : undefined}
                        className="text-right tabular"
                        {...register(`lines.${index}.debit`)}
                      />
                      {errors.lines?.[index]?.debit && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                          {errors.lines[index]?.debit?.message}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        aria-label={`Crédit, ligne ${index + 1}`}
                        aria-invalid={errors.lines?.[index]?.credit ? true : undefined}
                        className="text-right tabular"
                        {...register(`lines.${index}.credit`)}
                      />
                      {errors.lines?.[index]?.credit && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                          {errors.lines[index]?.credit?.message}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Supprimer la ligne ${index + 1}`}
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>

<tfoot>
  <tr className="border-t border-line bg-canvas">
    <td colSpan={2} className="px-4 py-3">
      <Button
        variant="secondary"
        size="sm"
        icon={<Plus className="size-4" aria-hidden="true" />}
        onClick={() => append(blankLine)}
      >
        Ajouter une ligne
      </Button>
    </td>

    <td className="px-2 py-3 text-right">
      <div className="text-xs text-ink-muted">Total débit</div>
      <div className="font-bold tabular">
        {formatNumber(totals.debit)}
      </div>
    </td>

    <td className="px-2 py-3 text-right">
      <div className="text-xs text-ink-muted">Total crédit</div>
      <div className="font-bold tabular">
        {formatNumber(totals.credit)}
      </div>
    </td>

    <td />
  </tr>
</tfoot>

            </table>
          </div>
          {errors.lines?.root?.message && (
            <p role="alert" className="px-4 py-2 text-xs text-danger">
              {errors.lines.root.message}
            </p>
          )}
          {errors.lines?.message && (
            <p role="alert" className="px-4 py-2 text-xs text-danger">
              {errors.lines.message}
            </p>
          )}
          <p
            role="status"
            className={`px-4 py-3 text-sm ${totals.balanced ? 'text-success' : totals.hasAmounts ? 'text-warning' : 'text-ink-muted'}`}
          >
            {totals.balanced
              ? 'Écriture équilibrée.'
              : totals.hasAmounts
                ? `Écart débit / crédit : ${formatNumber(totals.difference)}. L'écriture ne pourra pas être validée tant qu'elle n'est pas équilibrée.`
                : 'Saisissez les montants au débit et au crédit.'}
          </p>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate('/journal-entries')}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Enregistrer le brouillon
          </Button>
        </div>
      </form>
    </>
  )
}
