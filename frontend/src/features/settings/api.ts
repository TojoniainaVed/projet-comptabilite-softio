import { createResource } from '@/lib/resource'
import type { FiscalYear, Journal } from '@/types/api'

export interface JournalInput {
  code: string
  name: string
  type: string
  is_active: boolean
}

export interface FiscalYearInput {
  name: string
  starts_on: string
  ends_on: string
  status: 'open' | 'closed'
}

export const journalsApi = createResource<Journal, JournalInput>('journals', '/journals')
export const fiscalYearsApi = createResource<FiscalYear, FiscalYearInput>(
  'fiscal-years',
  '/fiscal-years',
)
