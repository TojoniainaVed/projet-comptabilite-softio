import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  BalanceSheetReport,
  GeneralLedgerReport,
  IncomeStatementReport,
  TreasuryReport,
  TrialBalanceReport,
} from '@/types/api'

interface Period {
  from?: string
  to?: string
}

export const useTrialBalance = (period: Period) =>
  useQuery({
    queryKey: ['reports', 'trial-balance', period],
    queryFn: ({ signal }) =>
      api.get<{ data: TrialBalanceReport }>('/reports/trial-balance', { ...period }, signal),
    select: (r) => r.data,
  })

export const useIncomeStatement = (period: Period) =>
  useQuery({
    queryKey: ['reports', 'income-statement', period],
    queryFn: ({ signal }) =>
      api.get<{ data: IncomeStatementReport }>('/reports/income-statement', { ...period }, signal),
    select: (r) => r.data,
  })

export const useBalanceSheet = (asOf: string) =>
  useQuery({
    queryKey: ['reports', 'balance-sheet', asOf],
    queryFn: ({ signal }) =>
      api.get<{ data: BalanceSheetReport }>('/reports/balance-sheet', { as_of: asOf }, signal),
    select: (r) => r.data,
  })

export const useTreasury = () =>
  useQuery({
    queryKey: ['reports', 'treasury'],
    queryFn: ({ signal }) =>
      api.get<{ data: TreasuryReport }>('/reports/treasury', undefined, signal),
    select: (r) => r.data,
  })

export const useGeneralLedger = (accountId: string, period: Period) =>
  useQuery({
    queryKey: ['reports', 'general-ledger', accountId, period],
    queryFn: ({ signal }) =>
      api.get<{ data: GeneralLedgerReport }>(
        '/reports/general-ledger',
        { account_id: accountId, ...period },
        signal,
      ),
    enabled: accountId !== '',
    select: (r) => r.data,
  })
