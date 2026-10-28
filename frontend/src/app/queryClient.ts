import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Inutile de réessayer une erreur applicative (401, 403, 404, 422) : seul un incident réseau ou serveur le justifie.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  })
}
