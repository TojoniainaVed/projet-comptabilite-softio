import { useCallback, useMemo, useState } from 'react'
import type { QueryParams } from '@/lib/api-client'

/** État de liste (page, recherche, filtres) ; tout changement de filtre ramène à la première page. */
export function useListParams(initial: Record<string, string> = {}) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>(initial)

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((current) => (current[key] === value ? current : { ...current, [key]: value }))
    setPage(1)
  }, [])

  const params = useMemo<QueryParams>(() => ({ ...filters, page }), [filters, page])

  return { page, setPage, filters, setFilter, params }
}
