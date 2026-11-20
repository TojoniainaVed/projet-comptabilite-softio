import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type { InvoiceType } from '@/types/api'

export type CreditNoteStatus = 'draft' | 'posted' | 'cancelled'

export interface CreditNoteInvoice {
  id: number
  number: string | null
  type: InvoiceType
  status: string
  invoice_date: string
  total: string
}

export interface CreditNotePartner {
  id: number
  name: string
  type: InvoiceType
}

export interface CreditNoteAccount {
  id: number
  code: string
  name: string
}

export interface CreditNoteLine {
  id: number
  credit_note_id: number
  invoice_line_id: number
  account_id: number
  account?: CreditNoteAccount | null
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
  net_amount: string
  tax_amount: string
}

export interface CreditNote {
  id: number
  number: string | null
  supplier_reference: string | null
  type: InvoiceType
  status: CreditNoteStatus
  credit_note_date: string
  reason: string
  notes: string | null
  currency: string
  subtotal: string
  tax_total: string
  total: string
  posted_at: string | null
  invoice?: CreditNoteInvoice
  partner?: CreditNotePartner
  lines?: CreditNoteLine[]
  created_at: string
  updated_at: string
}

export interface CreditNoteInput {
  invoice_id: number
  credit_note_date: string
  reason: string
  notes: string | null
  lines: {
    invoice_line_id: number
    description: string | null
    quantity: string
    unit_price: string
    tax_rate: string
  }[]
}

export const creditNotesApi = createResource<CreditNote, CreditNoteInput>(
  'credit-notes',
  '/credit-notes',
)

export function useCreditNoteActions() {
  const client = useQueryClient()

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: creditNotesApi.keys.all }),
      client.invalidateQueries({ queryKey: ['journal-entries'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ])

  return {
    post: useMutation({
      mutationFn: (id: number) => api.post<{ data: CreditNote }>(`/credit-notes/${id}/post`),
      onSuccess: refresh,
    }),
  }
}
