import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type QueryParams } from '@/lib/api-client'
import type { Paginated } from '@/types/api'

/**
 * Hooks TanStack Query pour une ressource REST standard (liste paginée, détail, création, mise à jour).
 * Les données serveur ne sont jamais recopiées dans un état local : le cache de TanStack Query fait foi.
 */
export function createResource<TItem, TInput = Record<string, unknown>>(
  name: string,
  path: string,
) {
  const keys = {
    all: [name] as const,
    list: (params: QueryParams) => [name, 'list', params] as const,
    detail: (id: number | string | undefined) => [name, 'detail', id] as const,
  }

  function useList(params: QueryParams = {}) {
    return useQuery({
      queryKey: keys.list(params),
      queryFn: ({ signal }) => api.get<Paginated<TItem>>(path, params, signal),
      placeholderData: keepPreviousData,
    })
  }

  /** Liste complète pour alimenter un menu déroulant (jusqu'à 500 éléments, sans pagination). */
  function useOptions(params: QueryParams = {}) {
    return useQuery({
      queryKey: keys.list({ ...params, all: 1 }),
      queryFn: ({ signal }) => api.get<{ data: TItem[] }>(path, { ...params, all: 1 }, signal),
      staleTime: 60_000,
      select: (result) => result.data,
    })
  }

  function useOne(id: number | string | undefined) {
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: ({ signal }) => api.get<{ data: TItem }>(`${path}/${id}`, undefined, signal),
      enabled: id !== undefined,
      select: (result) => result.data,
    })
  }

  function useCreate() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: (input: TInput) => api.post<{ data: TItem }>(path, input),
      onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
    })
  }

  function useUpdate() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: ({ id, input }: { id: number | string; input: TInput }) =>
        api.put<{ data: TItem }>(`${path}/${id}`, input),
      onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
    })
  }

  function useRemove() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: (id: number | string) => api.delete(`${path}/${id}`),
      onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
    })
  }

  return { keys, useList, useOptions, useOne, useCreate, useUpdate, useRemove }
}
