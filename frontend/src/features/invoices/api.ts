import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type { Invoice, InvoiceType, Payment } from '@/types/api'

export interface InvoiceInput {
  type?: InvoiceType
  partner_id: number
  supplier_reference: string | null
  invoice_date: string
  due_date: string
  notes: string | null
  lines: {
    account_id: number
    description: string
    quantity: string
    unit_price: string
    tax_rate: string
  }[]
}

export const invoicesApi = createResource<Invoice, InvoiceInput>('invoices', '/invoices')

export function useInvoiceActions() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: invoicesApi.keys.all }),
      client.invalidateQueries({ queryKey: ['payments'] }),
      client.invalidateQueries({ queryKey: ['journal-entries'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  return {
    post: useMutation({
      mutationFn: (id: number) => api.post<{ data: Invoice }>(`/invoices/${id}/post`),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
        api.post<{ data: Invoice }>(`/invoices/${id}/cancel`, { reason }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/invoices/${id}`),
      onSuccess: refresh,
    }),
    pay: useMutation({
      mutationFn: ({ id, key, body }: { id: number; key: string; body: Record<string, unknown> }) =>
        api.post<{ data: Payment }>(`/invoices/${id}/payments`, body, { 'Idempotency-Key': key }),
      onSuccess: refresh,
    }),
  }
}

export const invoiceBasePath = (kind: InvoiceType) =>
  kind === 'customer' ? '/sales/invoices' : '/purchases/invoices'
