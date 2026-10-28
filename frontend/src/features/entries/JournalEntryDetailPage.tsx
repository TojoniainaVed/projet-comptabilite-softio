import { useState } from 'react'
import { CheckCircle2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { EntryStatusBadge } from '@/components/ui/StatusBadges'
import { errorMessage } from '@/lib/form-errors'
import { formatDate, formatNumber } from '@/lib/utils'
import { computeEntryTotals } from '@/features/entries/balance'
import { entriesApi, useEntryActions } from '@/features/entries/api'

export function JournalEntryDetailPage() {
  const { id } = useParams()
  const entryId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const query = entriesApi.useOne(entryId)
  const actions = useEntryActions()
  const [confirm, setConfirm] = useState<'post' | 'delete' | null>(null)
  const [reversing, setReversing] = useState(false)
  const [reason, setReason] = useState('')
  const [reverseDate, setReverseDate] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />

  const entry = query.data
  const lines = entry.lines ?? []
  const totals = computeEntryTotals(lines)
  const fromDocument = entry.source_type !== null && entry.source_type !== undefined
  const isReversal = entry.reversal_of_id !== null

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

  return (
    <>
      <PageHeader
        title={entry.reference ?? 'Écriture brouillon'}
        description={entry.description}
        breadcrumbs={[
          { label: 'Écritures', to: '/journal-entries' },
          { label: entry.reference ?? 'Brouillon' },
        ]}
        actions={
          <>
            {entry.status === 'draft' && can('entries.update') && (
              <Link to={`/journal-entries/${entry.id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />}>
                  Modifier
                </Button>
              </Link>
            )}
            {entry.status === 'draft' && can('entries.update') && (
              <Button
                variant="secondary"
                icon={<Trash2 className="size-4" aria-hidden="true" />}
                onClick={() => setConfirm('delete')}
              >
                Supprimer
              </Button>
            )}
            {entry.status === 'draft' && can('entries.validate') && (
              <Button
                icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                onClick={() => setConfirm('post')}
              >
                Valider
              </Button>
            )}
            {entry.status === 'posted' && !fromDocument && !isReversal && can('entries.cancel') && (
              <Button
                variant="danger"
                icon={<RotateCcw className="size-4" aria-hidden="true" />}
                onClick={() => setReversing(true)}
              >
                Contrepasser
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
      {fromDocument && entry.status === 'posted' && (
        <div className="mb-4">
          <InlineAlert tone="info">
            Cette écriture est liée à un document (facture, paiement ou dépense) : elle ne peut être
            annulée qu'en annulant le document.
          </InlineAlert>
        </div>
      )}

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Journal</dt>
            <dd className="font-medium">
              {entry.journal ? `${entry.journal.code} — ${entry.journal.name}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Date</dt>
            <dd className="font-medium">{formatDate(entry.entry_date)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Statut</dt>
            <dd>
              <EntryStatusBadge status={entry.status} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Validée le</dt>
            <dd className="font-medium">{formatDate(entry.posted_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Lignes" padded={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Lignes de l'écriture</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold text-ink-muted uppercase">
                <th scope="col" className="px-4 py-2">
                  Compte
                </th>
                <th scope="col" className="px-4 py-2">
                  Libellé
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Débit
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Crédit
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-line">
                  <td className="px-4 py-2">
                    {line.account ? `${line.account.code} — ${line.account.name}` : line.account_id}
                  </td>
                  <td className="px-4 py-2">{line.label ?? '—'}</td>
                  <td className="tabular px-4 py-2 text-right">
                    {Number(line.debit) > 0 ? formatNumber(line.debit) : ''}
                  </td>
                  <td className="tabular px-4 py-2 text-right">
                    {Number(line.credit) > 0 ? formatNumber(line.credit) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas font-semibold">
                <td colSpan={2} className="px-4 py-2">
                  Total
                </td>
                <td className="tabular px-4 py-2 text-right">{formatNumber(totals.debit)}</td>
                <td className="tabular px-4 py-2 text-right">{formatNumber(totals.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirm === 'post'}
        title="Valider l'écriture"
        message="Une fois validée, l'écriture reçoit sa référence définitive et ne pourra plus être modifiée ni supprimée."
        confirmLabel="Valider"
        loading={actions.post.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => actions.post.mutateAsync(entry.id), 'Écriture validée.')}
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
            () => actions.remove.mutateAsync(entry.id),
            'Brouillon supprimé.',
            () => navigate('/journal-entries'),
          )
        }
      />
      <Modal
        open={reversing}
        onClose={() => setReversing(false)}
        title="Contrepasser l'écriture"
        description="Une écriture miroir (débits et crédits inversés) est créée et validée. L'écriture d'origine est conservée."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReversing(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={actions.reverse.isPending}
              onClick={() =>
                void run(
                  () =>
                    actions.reverse.mutateAsync({
                      id: entry.id,
                      reason: reason || undefined,
                      entry_date: reverseDate || undefined,
                    }),
                  'Écriture contrepassée.',
                  () => setReversing(false),
                )
              }
            >
              Contrepasser
            </Button>
          </>
        }
      >
        <div className="space-y-4">
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
          <FormField
            label="Date de la contrepassation"
            hint="Par défaut : date de l'écriture d'origine."
          >
            {(c) => (
              <DatePicker
                {...c}
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </Modal>
    </>
  )
}
