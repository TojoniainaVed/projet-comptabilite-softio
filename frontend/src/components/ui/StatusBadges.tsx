import type { CSSProperties } from 'react'
import { usePreferences } from '@/features/preferences/usePreferences'
import { statusColorOptions } from '@/features/preferences/preferences'
import type { EntryStatus, InvoiceStatus, StatusKey } from '@/types/api'
import type { CreditNoteStatus } from '@/features/credit-notes/api'


/** Pastille de statut : sa couleur est un réglage de l'utilisateur (panneau « Personnaliser »). */
export function StatusBadge({ status, label }: { status: StatusKey; label: string }) {
  const { preferences } = usePreferences()
  const name = preferences.status_colors[status]
  const hex = statusColorOptions.find((o) => o.value === name)?.hex ?? '#6b7280'
  return (
    <span
      className="status-badge inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ '--st': hex } as CSSProperties}
    >
      {label}
    </span>
  )
}

const entryStatuses: Record<EntryStatus, [StatusKey, string]> = {
  draft: ['draft', 'Brouillon'],
  posted: ['validated', 'Validée'],
  reversed: ['reversed', 'Contrepassée'],
}

const invoiceStatuses: Record<InvoiceStatus, [StatusKey, string]> = {
  draft: ['draft', 'Brouillon'],
  posted: ['validated', 'Validée'],
  paid: ['paid', 'Payée'],
  cancelled: ['cancelled', 'Annulée'],
}

const creditNoteStatuses: Record<CreditNoteStatus, [StatusKey, string]> = {
  draft: ['draft', 'Brouillon'],
  posted: ['validated', 'Validé'],
  cancelled: ['cancelled', 'Annulé'],
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const [key, label] = entryStatuses[status]
  return <StatusBadge status={key} label={label} />
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const [key, label] = invoiceStatuses[status]
  return <StatusBadge status={key} label={label} />
}

export function CreditNoteStatusBadge({ status }: { status: CreditNoteStatus }) {
  const [key, label] = creditNoteStatuses[status]
  return <StatusBadge status={key} label={label} />
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <StatusBadge status="validated" label="Actif" />
  ) : (
    <StatusBadge status="draft" label="Inactif" />
  )
}
