
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { CreditNoteStatusBadge } from '@/components/ui/StatusBadges'

import { useAuth } from '@/features/auth/AuthProvider'
import { creditNotesApi, useCreditNoteActions } from '@/features/credit-notes/api'

import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatMoney, formatNumber } from '@/lib/utils'

export function CreditNoteDetailPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>()

  const validKind = kind === 'customer' || kind === 'supplier'
  const creditNoteId = Number(id)

  const isCustomer = kind === 'customer'
  const base = isCustomer
    ? '/credit-notes/customers'
    : '/credit-notes/suppliers'

  const toast = useToast()
  const { can } = useAuth()

  const query = creditNotesApi.useOne(
    validKind && Number.isInteger(creditNoteId) && creditNoteId > 0
      ? creditNoteId
      : undefined,
  )

  const actions = useCreditNoteActions()

  const [confirm, setConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!validKind || !Number.isInteger(creditNoteId) || creditNoteId <= 0) {
    return <ErrorState message="Adresse de l’avoir invalide." />
  }

  if (query.isLoading) return <LoadingSpinner />

  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} />
  }

  const note = query.data

  if (note.type !== kind) {
    return <ErrorState message="Cet avoir ne correspond pas à cette catégorie." />
  }

  const draft = note.status === 'draft'
  const canValidate = draft && can('credit_notes.validate')

  const handleValidate = async () => {
    setActionError(null)

    try {
      await actions.post.mutateAsync(note.id)
      toast.success('Avoir validé avec succès.')
      setConfirm(false)
    } catch (error) {
      setActionError(errorMessage(error))
      setConfirm(false)
    }
  }

  return (
    <>
      <PageHeader
        title={note.number ?? `Brouillon #${note.id}`}
        description={note.partner?.name ?? 'Partenaire non renseigné'}
        breadcrumbs={[
          {
            label: isCustomer ? 'Avoirs clients' : 'Avoirs fournisseurs',
            to: base,
          },
          { label: note.number ?? 'Brouillon' },
        ]}
        actions={
          <>
            <Link to={base}>
              <Button variant="secondary">
                Retour à la liste
              </Button>
            </Link>

            {canValidate && (
              <Button
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                onClick={() => setConfirm(true)}
              >
                Valider l’avoir
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
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Statut</dt>
            <dd>
              <CreditNoteStatusBadge status={note.status} />
            </dd>
          </div>

          <div>
            <dt className="text-ink-muted">Date de l’avoir</dt>
            <dd className="font-medium">
              {formatDate(note.credit_note_date)}
            </dd>
          </div>

          <div>
            <dt className="text-ink-muted">Partenaire</dt>
            <dd className="font-medium">
              {note.partner?.name ?? '—'}
            </dd>
          </div>

          <div>
            <dt className="text-ink-muted">Facture d’origine</dt>
            <dd className="font-medium">
              {note.invoice?.number ?? `Facture #${note.invoice?.id ?? '—'}`}
            </dd>
          </div>
        </dl>

        {note.supplier_reference && (
          <p className="mt-3 text-sm text-ink-muted">
            Référence fournisseur : {note.supplier_reference}
          </p>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">Motif de l’avoir</p>
          <p className="mt-1 text-sm font-medium whitespace-pre-wrap">
            {note.reason || 'Aucun motif renseigné'}
          </p>
        </div>

        {note.posted_at && (
          <p className="mt-3 text-sm text-ink-muted">
            Validé le : {formatDate(note.posted_at)}
          </p>
        )}
      </Card>

      <Card title="Lignes de l’avoir" padded={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Détail des lignes de l’avoir</caption>

            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                <th scope="col" className="px-4 py-3">Description</th>
                <th scope="col" className="px-4 py-3">Compte</th>
                <th scope="col" className="px-4 py-3 text-right">Quantité</th>
                <th scope="col" className="px-4 py-3 text-right">Prix unitaire</th>
                <th scope="col" className="px-4 py-3 text-right">TVA %</th>
                <th scope="col" className="px-4 py-3 text-right">Total HT</th>
                <th scope="col" className="px-4 py-3 text-right">TVA</th>
              </tr>
            </thead>

            <tbody>
              {(note.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-line">
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3">
                    {line.account?.code ?? '—'}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatNumber(line.quantity)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatNumber(line.unit_price)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatNumber(line.tax_rate)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatNumber(line.net_amount)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatNumber(line.tax_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto w-full p-4 text-sm sm:w-80">
          <div className="flex justify-between py-1">
            <dt className="text-ink-muted">Total HT</dt>
            <dd className="tabular">
              {formatMoney(note.subtotal, note.currency)}
            </dd>
          </div>

          <div className="flex justify-between py-1">
            <dt className="text-ink-muted">TVA</dt>
            <dd className="tabular">
              {formatMoney(note.tax_total, note.currency)}
            </dd>
          </div>

          <div className="flex justify-between border-t border-line py-2 font-semibold">
            <dt>Total TTC</dt>
            <dd className="tabular">
              {formatMoney(note.total, note.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      {note.notes && (
        <Card title="Notes complémentaires" className="mt-6">
          <p className="text-sm whitespace-pre-wrap">{note.notes}</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        title="Valider cet avoir"
        message="Après validation, l’avoir reçoit son numéro définitif et l’écriture comptable correspondante est générée. Vérifiez les informations avant de continuer."
        confirmLabel="Confirmer la validation"
        loading={actions.post.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void handleValidate()}
      />
    </>
  )
}
