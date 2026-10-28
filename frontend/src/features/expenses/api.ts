import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type { Expense } from '@/types/api'

export interface ExpenseInput {
  expense_date: string
  description: string
  amount: string
  account_id: number
  paid_from_account_id: number
  partner_id: number | null
  reference: string | null
}

export const expensesApi = createResource<Expense, ExpenseInput>('expenses', '/expenses')

export function useExpenseActions() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: expensesApi.keys.all }),
      client.invalidateQueries({ queryKey: ['journal-entries'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  return {
    post: useMutation({
      mutationFn: (id: number) => api.post<{ data: Expense }>(`/expenses/${id}/post`),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/expenses/${id}`),
      onSuccess: refresh,
    }),
  }
}
