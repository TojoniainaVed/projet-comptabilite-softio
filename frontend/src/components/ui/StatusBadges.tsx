import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { EntryStatus, InvoiceStatus } from '@/types/api'

const entryTones: Record<EntryStatus, [BadgeTone, string]> = {
  draft: ['neutral', 'Brouillon'],
  posted: ['success', 'Validée'],
  reversed: ['warning', 'Contrepassée'],
}

const invoiceTones: Record<InvoiceStatus, [BadgeTone, string]> = {
  draft: ['neutral', 'Brouillon'],
  posted: ['info', 'Validée'],
  paid: ['success', 'Payée'],
  cancelled: ['danger', 'Annulée'],
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const [tone, label] = entryTones[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const [tone, label] = invoiceTones[status]
  return <Badge tone={tone}>{label}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Actif' : 'Inactif'}</Badge>
}
