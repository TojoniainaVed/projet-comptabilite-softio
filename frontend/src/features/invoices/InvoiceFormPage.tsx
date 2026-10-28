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
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { emptyToNull, moneyString } from '@/lib/validation'
import { formatNumber, todayIso } from '@/lib/utils'
import { accountsApi } from '@/features/accounts/api'
import { customersApi, suppliersApi } from '@/features/partners/api'
import { computeInvoiceTotals } from '@/features/invoices/totals'
import { invoiceBasePath, invoicesApi } from '@/features/invoices/api'
import type { InvoiceType } from '@/types/api'

const num = (v: string) => Number(v.replace(',', '.'))

const lineSchema = z.object({
  account_id: z.string().min(1, 'Choisissez un compte.'),
  description: z.string().trim().min(1, 'Description obligatoire.').max(255),
  quantity: moneyString('Quantité invalide.').refine(
    (v) => num(v) > 0,
    'Doit être supérieure à zéro.',
  ),
  unit_price: moneyString('Prix invalide.'),
  tax_rate: moneyString('Taux invalide.').refine(
    (v) => num(v) >= 0 && num(v) <= 100,
    'Entre 0 et 100.',
  ),
})

const schema = z
  .object({
    partner_id: z.string().min(1, 'Choisissez un partenaire.'),
    supplier_reference: z.string().max(100),
    invoice_date: z.string().min(1, 'Date obligatoire.'),
    due_date: z.string().min(1, "Date d'échéance obligatoire."),
    notes: z.string().max(2000),
    lines: z.array(lineSchema).min(1, 'Ajoutez au moins une ligne.'),
  })
  .refine((v) => !v.invoice_date || !v.due_date || v.due_date >= v.invoice_date, {
    message: "L'échéance ne peut pas précéder la date de facture.",
    path: ['due_date'],
  })
type Values = z.infer<typeof schema>

const blankLine = { account_id: '', description: '', quantity: '1', unit_price: '', tax_rate: '0' }

export function InvoiceFormPage({ kind }: { kind: InvoiceType }) {
  const isCustomer = kind === 'customer'
  const base = invoiceBasePath(kind)
  const { id } = useParams()
  const invoiceId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const toast = useToast()
  const existing = invoicesApi.useOne(invoiceId)
  const partners = (isCustomer ? customersApi : suppliersApi).useOptions({ is_active: 1 })
  const accounts = accountsApi.useOptions({ is_active: 1, type: isCustomer ? 'income' : 'expense' })
  const create = invoicesApi.useCreate()
  const update = invoicesApi.useUpdate()
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
      partner_id: '',
      supplier_reference: '',
      invoice_date: todayIso(),
      due_date: todayIso(),
      notes: '',
      lines: [blankLine],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watched = useWatch({ control, name: 'lines' })
  const totals = computeInvoiceTotals(watched ?? [])

  useEffect(() => {
    const invoice = existing.data
    if (!invoice) return
    reset({
      partner_id: String(invoice.partner_id),
      supplier_reference: invoice.supplier_reference ?? '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      notes: invoice.notes ?? '',
      lines: (invoice.lines ?? []).map((l) => ({
        account_id: String(l.account_id),
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
      })),
    })
  }, [existing.data, reset])

  if (invoiceId !== undefined && existing.isLoading) return <LoadingSpinner />
  if (invoiceId !== undefined && existing.isError)
    return <ErrorState message={errorMessage(existing.error)} />
  if (existing.data && existing.data.status !== 'draft') {
    return <InlineAlert>Seule une facture brouillon peut être modifiée.</InlineAlert>
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      partner_id: Number(values.partner_id),
      supplier_reference: isCustomer ? null : emptyToNull(values.supplier_reference),
      invoice_date: values.invoice_date,
      due_date: values.due_date,
      notes: emptyToNull(values.notes),
      lines: values.lines.map((l) => ({
        account_id: Number(l.account_id),
        description: l.description,
        quantity: l.quantity.replace(',', '.'),
        unit_price: l.unit_price.replace(',', '.'),
        tax_rate: l.tax_rate.replace(',', '.'),
      })),
    }
    try {
      const result = invoiceId
        ? await update.mutateAsync({ id: invoiceId, input })
        : await create.mutateAsync({ ...input, type: kind })
      toast.success('Brouillon enregistré.')
      navigate(`${base}/${result.data.id}`)
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <>
      <PageHeader
        title={
          invoiceId
            ? 'Modifier la facture'
            : isCustomer
              ? 'Nouvelle facture client'
              : 'Nouvelle facture fournisseur'
        }
        breadcrumbs={[
          { label: isCustomer ? 'Factures clients' : 'Factures fournisseurs', to: base },
          { label: invoiceId ? 'Modifier' : 'Nouvelle' },
        ]}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              label={isCustomer ? 'Client' : 'Fournisseur'}
              error={errors.partner_id?.message}
              required
            >
              {(c) => (
                <Select {...c} {...register('partner_id')}>
                  <option value="">Sélectionner…</option>
                  {partners.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Date de facture" error={errors.invoice_date?.message} required>
              {(c) => <DatePicker {...c} {...register('invoice_date')} />}
            </FormField>
            <FormField label="Échéance" error={errors.due_date?.message} required>
              {(c) => <DatePicker {...c} {...register('due_date')} />}
            </FormField>
            {!isCustomer && (
              <FormField label="Référence fournisseur" error={errors.supplier_reference?.message}>
                {(c) => <Input {...c} {...register('supplier_reference')} />}
              </FormField>
            )}
          </div>
        </Card>

        <Card title="Lignes" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Lignes de la facture</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2">
                    {isCustomer ? 'Compte de produit' : 'Compte de charge'}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Description
                  </th>
                  <th scope="col" className="w-24 px-2 py-2">
                    Qté
                  </th>
                  <th scope="col" className="w-32 px-2 py-2">
                    Prix unitaire
                  </th>
                  <th scope="col" className="w-24 px-2 py-2">
                    TVA %
                  </th>
                  <th scope="col" className="w-32 px-2 py-2 text-right">
                    Total HT
                  </th>
                  <th scope="col" className="w-12 px-2 py-2">
                    <span className="sr-only">Supprimer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const lineErrors = errors.lines?.[index]
                  const cell = (
                    name: 'account_id' | 'description' | 'quantity' | 'unit_price' | 'tax_rate',
                  ) =>
                    lineErrors?.[name] && (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {lineErrors[name]?.message}
                      </p>
                    )
                  return (
                    <tr key={field.id} className="border-b border-line align-top">
                      <td className="px-4 py-2">
                        <Select
                          aria-label={`Compte, ligne ${index + 1}`}
                          aria-invalid={lineErrors?.account_id ? true : undefined}
                          {...register(`lines.${index}.account_id`)}
                        >
                          <option value="">Sélectionner…</option>
                          {accounts.data?.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </Select>
                        {cell('account_id')}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          aria-label={`Description, ligne ${index + 1}`}
                          aria-invalid={lineErrors?.description ? true : undefined}
                          {...register(`lines.${index}.description`)}
                        />
                        {cell('description')}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`Quantité, ligne ${index + 1}`}
                          aria-invalid={lineErrors?.quantity ? true : undefined}
                          className="text-right tabular"
                          {...register(`lines.${index}.quantity`)}
                        />
                        {cell('quantity')}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`Prix unitaire, ligne ${index + 1}`}
                          aria-invalid={lineErrors?.unit_price ? true : undefined}
                          className="text-right tabular"
                          {...register(`lines.${index}.unit_price`)}
                        />
                        {cell('unit_price')}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`TVA, ligne ${index + 1}`}
                          aria-invalid={lineErrors?.tax_rate ? true : undefined}
                          className="text-right tabular"
                          {...register(`lines.${index}.tax_rate`)}
                        />
                        {cell('tax_rate')}
                      </td>
                      <td className="tabular px-2 py-4 text-right">
                        {formatNumber(totals.lines[index]?.net)}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Supprimer la ligne ${index + 1}`}
                          disabled={fields.length <= 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {errors.lines?.message && (
            <p role="alert" className="px-4 py-2 text-xs text-danger">
              {errors.lines.message}
            </p>
          )}
          <div className="flex flex-col gap-4 border-t border-line p-4 sm:flex-row sm:items-start sm:justify-between">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => append(blankLine)}
            >
              Ajouter une ligne
            </Button>
            <dl className="w-full text-sm sm:w-64">
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-muted">Total HT</dt>
                <dd className="tabular" data-testid="subtotal">
                  {formatNumber(totals.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt className="text-ink-muted">TVA</dt>
                <dd className="tabular" data-testid="tax">
                  {formatNumber(totals.tax)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line py-1 font-semibold">
                <dt>Total TTC</dt>
                <dd className="tabular" data-testid="total">
                  {formatNumber(totals.total)}
                </dd>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Aperçu : les montants définitifs sont calculés par le serveur.
              </p>
            </dl>
          </div>
        </Card>

        <Card>
          <FormField label="Notes" error={errors.notes?.message}>
            {(c) => <Textarea {...c} {...register('notes')} />}
          </FormField>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(base)}>
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
