import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type {
  AccountingDefaults,
  Company,
  FiscalYear,
  Journal,
  PaymentTerm,
  Tax,
} from '@/types/api'

export interface JournalInput {
  code: string
  name: string
  type: string
  next_number?: number
  is_active: boolean
}

export interface FiscalYearInput {
  name: string
  starts_on: string
  ends_on: string
  status: 'open' | 'closed'
}

export interface TaxInput {
  name: string
  rate: string
  scope: 'sales' | 'purchases'
  is_active: boolean
}

export interface PaymentTermInput {
  name: string
  days: number
  end_of_month: boolean
  is_active: boolean
}

export interface CompanyInput {
  name: string
  legal_name: string | null
  tax_id: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export const journalsApi = createResource<Journal, JournalInput>('journals', '/journals')
export const fiscalYearsApi = createResource<FiscalYear, FiscalYearInput>(
  'fiscal-years',
  '/fiscal-years',
)
export const taxesApi = createResource<Tax, TaxInput>('taxes', '/taxes')
export const paymentTermsApi = createResource<PaymentTerm, PaymentTermInput>(
  'payment-terms',
  '/payment-terms',
)

/* Société */

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company-settings'],
    queryFn: ({ signal }) => api.get<{ data: Company }>('/company', undefined, signal),
    select: (result) => result.data,
  })
}

export function useUpdateCompany() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CompanyInput) => api.put<{ data: Company }>('/company', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['company-settings'] })
      // Les factures imprimées reprennent ces informations.
      void client.invalidateQueries({ queryKey: ['invoice-company'] })
    },
  })
}

/* Comptes par défaut */

export function useAccountingDefaults() {
  return useQuery({
    queryKey: ['accounting-defaults'],
    queryFn: ({ signal }) =>
      api.get<{ data: AccountingDefaults }>('/accounting-defaults', undefined, signal),
    select: (result) => result.data,
  })
}

export function useUpdateAccountingDefaults() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AccountingDefaults) =>
      api.put<{ data: AccountingDefaults }>('/accounting-defaults', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['accounting-defaults'] }),
  })
}
