import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'

import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { emptyToNull, moneyString } from '@/lib/validation'
import { formatNumber, todayIso } from '@/lib/utils'

import { invoicesApi } from '@/features/invoices/api'
import { creditNotesApi } from '@/features/credit-notes/api'
import type { InvoiceType } from '@/types/api'

const num = (value: string) => Number(value.replace(',', '.'))

const schema = z
  .object({
    invoice_id: z.string().min(1, 'Sélectionnez une facture d’origine.'),
    credit_note_date: z.string().min(1, 'Date obligatoire.'),
    reason: z.string().trim().min(1, 'Le motif est obligatoire.').max(255),
    notes: z.string().max(10000),
    lines: z.array(
      z.object({
        invoice_line_id: z.string().min(1),
        quantity: moneyString('Quantité invalide.').refine(
          (value) => num(value) >= 0,
          'La quantité ne peut pas être négative.',
        ),
      }),
    ),
  })
  .refine((values) => values.lines.some((line) => num(line.quantity) > 0), {
    message: 'Saisissez une quantité à créditer sur au moins une ligne.',
    path: ['lines'],
  })

type Values = z.infer<typeof schema>

export function CreditNoteFormPage({ kind }: { kind: InvoiceType }) {
  const isCustomer = kind === 'customer'
  const base = isCustomer ? '/credit-notes/customers' : '/credit-notes/suppliers'

  const navigate = useNavigate()
  const toast = useToast()

  const [formError, setFormError] = useState<string | null>(null)

  // Factures du type correspondant à l'avoir.
  const invoices = invoicesApi.useOptions({ type: kind })

  const create = creditNotesApi.useCreate()

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice_id: '',
      credit_note_date: todayIso(),
      reason: '',
      notes: '',
      lines: [],
    },
  })

  const selectedInvoiceId = useWatch({
    control,
    name: 'invoice_id',
  })

  const invoiceId = selectedInvoiceId ? Number(selectedInvoiceId) : undefined

  // Détail de la facture sélectionnée, avec ses lignes et son partenaire.
  const invoice = invoicesApi.useOne(invoiceId)

  // Seules les factures validées ou payées peuvent être créditées.
  const eligibleInvoices = useMemo(
    () =>
      (invoices.data ?? []).filter(
        (item) => item.status === 'posted' || item.status === 'paid',
      ),
    [invoices.data],
  )

  // Prépare les lignes de la facture sélectionnée.
  useEffect(() => {
    if (!invoice.data) return

    reset((current) => ({
      ...current,
      lines: (invoice.data.lines ?? []).map((line) => ({
        invoice_line_id: String(line.id),
        quantity: '0',
      })),
    }))
  }, [invoice.data, reset])

  const watchedLines = useWatch({
    control,
    name: 'lines',
  })

  // Calcul indicatif des montants, à partir des données de la facture d'origine.
  const totals = useMemo(() => {
    const originalLines = invoice.data?.lines ?? []

    let subtotal = 0
    let tax = 0

    for (const selectedLine of watchedLines ?? []) {
      const original = originalLines.find(
        (line) => String(line.id) === selectedLine.invoice_line_id,
      )

      if (!original) continue

      const quantity = Math.max(0, num(selectedLine.quantity || '0'))
      const net = quantity * num(original.unit_price)
      const lineTax = net * (num(original.tax_rate) / 100)

      subtotal += net
      tax += lineTax
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    }
  }, [invoice.data, watchedLines])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const originalLines = invoice.data?.lines ?? []

    const lines = values.lines
      .filter((line) => num(line.quantity) > 0)
      .map((line) => {
        const original = originalLines.find(
          (item) => item.id === Number(line.invoice_line_id),
        )

        if (!original) {
          throw new Error('Une ligne de la facture d’origine est introuvable.')
        }

        return {
          invoice_line_id: original.id,
          description: original.description,
          quantity: line.quantity.replace(',', '.'),
          unit_price: original.unit_price,
          tax_rate: original.tax_rate,
        }
      })

    const input = {
      invoice_id: Number(values.invoice_id),
      credit_note_date: values.credit_note_date,
      reason: values.reason.trim(),
      notes: emptyToNull(values.notes),
      lines,
    }

    try {
      await create.mutateAsync(input)

      toast.success('Brouillon d’avoir enregistré.')
      navigate(base)
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  if (invoices.isLoading) return <LoadingSpinner />

  if (invoices.isError) {
    return <ErrorState message={errorMessage(invoices.error)} />
  }

  const selectedInvoice = invoice.data

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Nouvel avoir client' : 'Nouvel avoir fournisseur'}
        breadcrumbs={[
          {
            label: isCustomer ? 'Avoirs clients' : 'Avoirs fournisseurs',
            to: base,
          },
          { label: 'Nouvel avoir' },
        ]}
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {formError && <InlineAlert>{formError}</InlineAlert>}

        <Card title="Facture d’origine">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label={isCustomer ? 'Facture client' : 'Facture fournisseur'}
              error={errors.invoice_id?.message}
              required
            >
              {(c) => (
                <Select {...c} {...register('invoice_id')}>
                  <option value="">Sélectionner une facture…</option>

                  {eligibleInvoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.number ?? `Facture #${item.id}`} — {item.total}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField
              label="Date de l’avoir"
              error={errors.credit_note_date?.message}
              required
            >
              {(c) => (
                <DatePicker {...c} {...register('credit_note_date')} />
              )}
            </FormField>
          </div>

          {eligibleInvoices.length === 0 && (
            <p className="mt-3 text-sm text-ink-muted">
              Aucune facture validée ou payée n’est disponible pour ce type
              d’avoir.
            </p>
          )}

          {invoice.isLoading && invoiceId !== undefined && (
            <div className="mt-4">
              <LoadingSpinner />
            </div>
          )}

          {invoice.isError && (
            <div className="mt-4">
              <InlineAlert>{errorMessage(invoice.error)}</InlineAlert>
            </div>
          )}

          {selectedInvoice && (
            <div className="mt-4 grid gap-3 rounded-lg border border-line bg-canvas p-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-ink-muted">Partenaire</p>
                <p className="font-medium">
                  {selectedInvoice.partner?.name ?? '—'}
                </p>
              </div>

              <div>
                <p className="text-ink-muted">Date de facture</p>
                <p className="font-medium">{selectedInvoice.invoice_date}</p>
              </div>

              <div>
                <p className="text-ink-muted">Total de la facture</p>
                <p className="font-medium tabular">
                  {formatNumber(Number(selectedInvoice.total))}
                  {' '}
                  {selectedInvoice.currency}
                </p>
              </div>
            </div>
          )}
        </Card>

        {selectedInvoice && (
          <Card title="Lignes à créditer" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">
                  Lignes de la facture d’origine à créditer
                </caption>

                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-xs font-semibold uppercase text-ink-muted">
                    <th className="px-4 py-3">Description</th>
                    <th className="px-2 py-3 text-right">Qté facturée</th>
                    <th className="px-2 py-3 text-right">Prix unitaire</th>
                    <th className="px-2 py-3 text-right">TVA %</th>
                    <th className="w-32 px-4 py-3 text-right">
                      Qté à créditer
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(selectedInvoice.lines ?? []).map((line, index) => (
                    <tr key={line.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <p className="font-medium">{line.description}</p>
                        {line.account && (
                          <p className="text-xs text-ink-muted">
                            {line.account.code} — {line.account.name}
                          </p>
                        )}
                      </td>

                      <td className="px-2 py-3 text-right tabular">
                        {line.quantity}
                      </td>

                      <td className="px-2 py-3 text-right tabular">
                        {formatNumber(Number(line.unit_price))}
                      </td>

                      <td className="px-2 py-3 text-right tabular">
                        {line.tax_rate} %
                      </td>

                      <td className="px-4 py-3">
                        <Input
                          inputMode="decimal"
                          aria-label={`Quantité à créditer, ligne ${index + 1}`}
                          className="text-right tabular"
                          {...register(`lines.${index}.quantity`)}
                        />

                        {errors.lines?.[index]?.quantity?.message && (
                          <p role="alert" className="mt-1 text-xs text-danger">
                            {errors.lines[index]?.quantity?.message}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errors.lines?.message && (
              <p role="alert" className="px-4 py-3 text-xs text-danger">
                {errors.lines.message}
              </p>
            )}

            <div className="flex justify-end border-t border-line p-4">
              <dl className="w-full text-sm sm:w-72">
                <div className="flex justify-between py-1">
                  <dt className="text-ink-muted">Total HT</dt>
                  <dd className="tabular">{formatNumber(totals.subtotal)}</dd>
                </div>

                <div className="flex justify-between py-1">
                  <dt className="text-ink-muted">TVA</dt>
                  <dd className="tabular">{formatNumber(totals.tax)}</dd>
                </div>

                <div className="flex justify-between border-t border-line py-2 font-semibold">
                  <dt>Total TTC</dt>
                  <dd className="tabular">{formatNumber(totals.total)}</dd>
                </div>

                <p className="mt-1 text-xs text-ink-muted">
                  Estimation indicative. Les montants définitifs sont calculés
                  et vérifiés par le serveur.
                </p>
              </dl>
            </div>
          </Card>
        )}

        <Card title="Motif et informations complémentaires">
          <div className="space-y-4">
            <FormField
              label="Motif de l’avoir"
              error={errors.reason?.message}
              required
            >
              {(c) => (
                <Input
                  {...c}
                  {...register('reason')}
                  placeholder="Ex. : Retour de marchandises, erreur de facturation…"
                />
              )}
            </FormField>

            <FormField label="Notes" error={errors.notes?.message}>
              {(c) => (
                <Textarea
                  {...c}
                  {...register('notes')}
                  placeholder="Informations complémentaires…"
                />
              )}
            </FormField>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(base)}
          >
            Annuler
          </Button>

          <Button
            type="submit"
            loading={isSubmitting || create.isPending}
            disabled={!selectedInvoice || invoice.isLoading}
          >
            Enregistrer le brouillon
          </Button>
        </div>
      </form>
    </>
  )
}