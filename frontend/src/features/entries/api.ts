import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type { JournalEntry } from '@/types/api'

export interface EntryInput {
  journal_id: number
  entry_date: string
  description: string
  lines: { account_id: number; label: string | null; debit: string | null; credit: string | null }[]
}

export const entriesApi = createResource<JournalEntry, EntryInput>(
  'journal-entries',
  '/journal-entries',
)

export function useEntryActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: entriesApi.keys.all })
  return {
    post: useMutation({
      mutationFn: (id: number) => api.post<{ data: JournalEntry }>(`/journal-entries/${id}/post`),
      onSuccess: refresh,
    }),
    reverse: useMutation({
      mutationFn: ({
        id,
        reason,
        entry_date,
      }: {
        id: number
        reason?: string
        entry_date?: string
      }) =>
        api.post<{ data: JournalEntry }>(`/journal-entries/${id}/reverse`, { reason, entry_date }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/journal-entries/${id}`),
      onSuccess: refresh,
    }),
  }
}
