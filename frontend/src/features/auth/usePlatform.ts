import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { PublicPlatform } from '@/types/api'

/** Informations publiques de la plateforme (nom, inscription ouverte, politique de mot de passe). */
export function usePlatform(): PublicPlatform | undefined {
  const { data } = useQuery({
    queryKey: ['platform'],
    queryFn: ({ signal }) => api.get<{ data: PublicPlatform }>('/platform', undefined, signal),
    staleTime: 5 * 60_000,
    retry: false,
  })
  return data?.data
}