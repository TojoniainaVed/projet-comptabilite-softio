import { useState } from 'react'
import { Ban, CheckCircle2, CreditCard, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { InvoiceStatusBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney, formatNumber } from '@/lib/utils'
import { invoiceBasePath, invoicesApi, useInvoiceActions } from '@/features/invoices/api'
import { PayInvoiceModal } from '@/features/invoices/PayInvoiceModal'
import type { InvoiceType } from '@/types/api'

export function InvoiceDetailPage({ kind }: { kind: InvoiceType }) {
  const isCustomer = kind === 'customer'
  const base = invoiceBasePath(kind)
  const { id } = useParams()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const query = invoicesApi.useOne(invoiceId)
  const actions = useInvoiceActions()
  const [confirm, setConfirm] = useState<'post' | 'delete' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [paying, setPaying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />
  const invoice = query.data

  const run = async (fn: () => Promise<unknown>, success: string, done?: () => void) => {
    setActionError(null)
    try {
      await fn()
      toast.success(success)
      done?.()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  const draft = invoice.status === 'draft'
  const canPay = invoice.status === 'posted' && can('payments.create') && can('invoices.view')

  return (
    <>
      <PageHeader
        title={invoice.number ?? 'Facture brouillon'}
        description={invoice.partner?.name}
        breadcrumbs={[
          { label: isCustomer ? 'Factures clients' : 'Factures fournisseurs', to: base },
          { label: invoice.number ?? 'Brouillon' },
        ]}
        actions={
          <>
            {draft && can('invoices.update') && (
              <>
                <Link to={`${base}/${invoice.id}/edit`}>
                  <Button
                    variant="secondary"
                    icon={<Pencil className="size-4" aria-hidden="true" />}
                  >
                    Modifier
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  icon={<Trash2 className="size-4" aria-hidden="true" />}
                  onClick={() => setConfirm('delete')}
                >
                  Supprimer
                </Button>
              </>
            )}
            {draft && can('invoices.validate') && (
              <Button
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                onClick={() => setConfirm('post')}
              >
                Valider
              </Button>
            )}
            {canPay && (
              <Button
                icon={<CreditCard className="size-4" aria-hidden="true" />}
                onClick={() => setPaying(true)}
              >
                Enregistrer un paiement
              </Button>
            )}
            {invoice.status === 'posted' && can('invoices.cancel') && (
              <Button
                variant="danger"
                icon={<Ban className="size-4" aria-hidden="true" />}
                onClick={() => setCancelling(true)}
              >
                Annuler la facture
              </Button>
            )}
          </>
        }
      />
      {actionError && (
        <div className="mb-4">
          <InlineAlert>{actionError}</InlineAlert>
        </div>
      )}

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-ink-muted">Statut</dt>
            <dd>
              <InvoiceStatusBadge status={invoice.status} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Date</dt>
            <dd className="font-medium">{formatDate(invoice.invoice_date)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Échéance</dt>
            <dd className="font-medium">{formatDate(invoice.due_date)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Déjà réglé</dt>
            <dd className="tabular font-medium">
              {formatMoney(invoice.amount_paid, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Reste dû</dt>
            <dd className="tabular font-medium">
              {formatMoney(invoice.amount_due, invoice.currency)}
            </dd>
          </div>
        </dl>
        {invoice.supplier_reference && (
          <p className="mt-3 text-sm text-ink-muted">
            Référence fournisseur : {invoice.supplier_reference}
          </p>
        )}
        {invoice.journal_entry_id && (
          <p className="mt-3 text-sm">
            <Link
              className="text-brand-700 hover:underline"
              to={`/journal-entries/${invoice.journal_entry_id}`}
            >
              Voir l'écriture comptable associée
            </Link>
          </p>
        )}
      </Card>

      <Card title="Lignes" padded={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Lignes de la facture</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                <th scope="col" className="px-4 py-2">
                  Description
                </th>
                <th scope="col" className="px-4 py-2">
                  Compte
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Qté
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Prix unitaire
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  TVA %
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-line">
                  <td className="px-4 py-2">{line.description}</td>
                  <td className="px-4 py-2">{line.account?.code}</td>
                  <td className="tabular px-4 py-2 text-right">{formatNumber(line.quantity)}</td>
                  <td className="tabular px-4 py-2 text-right">{formatNumber(line.unit_price)}</td>
                  <td className="tabular px-4 py-2 text-right">{formatNumber(line.tax_rate)}</td>
                  <td className="tabular px-4 py-2 text-right">{formatNumber(line.net_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto w-full p-4 text-sm sm:w-72">
          <div className="flex justify-between py-0.5">
            <dt className="text-ink-muted">Total HT</dt>
            <dd className="tabular">{formatMoney(invoice.subtotal, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between py-0.5">
            <dt className="text-ink-muted">TVA</dt>
            <dd className="tabular">{formatMoney(invoice.tax_total, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line py-1 font-semibold">
            <dt>Total TTC</dt>
            <dd className="tabular">{formatMoney(invoice.total, invoice.currency)}</dd>
          </div>
        </dl>
      </Card>
      {invoice.notes && (
        <Card title="Notes" className="mt-6">
          <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirm === 'post'}
        title="Valider la facture"
        message="La facture reçoit son numéro définitif et l'écriture comptable est générée. Elle ne sera plus modifiable."
        confirmLabel="Valider"
        loading={actions.post.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => actions.post.mutateAsync(invoice.id), 'Facture validée.')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Supprimer le brouillon"
        message="Ce brouillon sera définitivement supprimé."
        confirmLabel="Supprimer"
        danger
        loading={actions.remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          void run(
            () => actions.remove.mutateAsync(invoice.id),
            'Brouillon supprimé.',
            () => navigate(base),
          )
        }
      />
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Annuler la facture"
        description="L'écriture est contrepassée. Une facture déjà réglée (même partiellement) ne peut pas être annulée."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              Retour
            </Button>
            <Button
              variant="danger"
              loading={actions.cancel.isPending}
              onClick={() =>
                void run(
                  () => actions.cancel.mutateAsync({ id: invoice.id, reason: reason || undefined }),
                  'Facture annulée.',
                  () => setCancelling(false),
                )
              }
            >
              Annuler la facture
            </Button>
          </>
        }
      >
        <FormField label="Motif">
          {(c) => (
            <Input
              {...c}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          )}
        </FormField>
      </Modal>
      {canPay && (
        <PayInvoiceModal invoice={invoice} open={paying} onClose={() => setPaying(false)} />
      )}
    </>
  )
}
