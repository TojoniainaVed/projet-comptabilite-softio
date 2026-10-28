import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { applyApiErrors } from '@/lib/form-errors'
import { paymentMethodLabels, optionsOf } from '@/lib/labels'
import { emptyToNull, normalizeMoney, positiveMoney } from '@/lib/validation'
import { formatMoney, todayIso } from '@/lib/utils'
import { accountsApi } from '@/features/accounts/api'
import { useInvoiceActions } from '@/features/invoices/api'
import type { Invoice } from '@/types/api'

const schema = z.object({
  amount: positiveMoney(),
  paid_on: z.string().min(1, 'Date obligatoire.'),
  method: z.enum(['bank_transfer', 'cash', 'check', 'card']),
  treasury_account_id: z.string().min(1, 'Choisissez un compte de trésorerie.'),
  reference: z.string().max(100),
})
type Values = z.infer<typeof schema>

/**
 * Enregistrement d'un règlement. Une clé d'idempotence unique est générée à l'ouverture du formulaire
 * et conservée tant que le paiement n'a pas abouti : un double clic ou une nouvelle tentative après une
 * coupure réseau ne peut donc jamais créer deux paiements.
 */
export function PayInvoiceModal({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice
  open: boolean
  onClose: () => void
}) {
  // Monté seulement à l'ouverture : chaque ouverture repart d'un formulaire neuf et d'une nouvelle clé.
  return open ? <PayInvoiceForm invoice={invoice} onClose={onClose} /> : null
}

function PayInvoiceForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const toast = useToast()
  const { pay } = useInvoiceActions()
  const accounts = accountsApi.useOptions({ is_active: 1 })
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [formError, setFormError] = useState<string | null>(null)
  const treasury = (accounts.data ?? []).filter(
    (a) => a.category === 'bank' || a.category === 'cash',
  )

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: invoice.amount_due,
      paid_on: todayIso(),
      method: 'bank_transfer',
      treasury_account_id: '',
      reference: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await pay.mutateAsync({
        id: invoice.id,
        key: idempotencyKey,
        body: {
          amount: normalizeMoney(values.amount),
          paid_on: values.paid_on,
          method: values.method,
          treasury_account_id: Number(values.treasury_account_id),
          reference: emptyToNull(values.reference),
        },
      })
      toast.success('Paiement enregistré.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Enregistrer un paiement"
      description={`Reste dû : ${formatMoney(invoice.amount_due, invoice.currency)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="pay-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
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
        <FormField label="Date du paiement" error={errors.paid_on?.message} required>
          {(c) => <DatePicker {...c} {...register('paid_on')} />}
        </FormField>
        <FormField label="Mode de paiement" error={errors.method?.message} required>
          {(c) => (
            <Select {...c} {...register('method')}>
              {optionsOf(paymentMethodLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Compte de trésorerie"
          error={errors.treasury_account_id?.message}
          required
          hint="Comptes dont le rôle est « Banque » ou « Caisse »."
        >
          {(c) => (
            <Select {...c} {...register('treasury_account_id')}>
              <option value="">Sélectionner…</option>
              {treasury.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
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
