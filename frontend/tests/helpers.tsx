import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { vi } from 'vitest'
import { Providers } from '@/app/providers'
import { createQueryClient } from '@/app/queryClient'
import { authStorage } from '@/lib/auth-storage'
import type { AuthUser } from '@/types/api'

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: 'Rina Comptable',
    email: 'rina@example.test',
    is_active: true,
    last_login_at: null,
    company: { id: 1, name: 'Société Test', currency: 'MGA', locale: 'fr' },
    role: { id: 3, slug: 'accountant', name: 'Comptable', scope: 'company' },
    permissions: [],
    ...overrides,
  }
}

type Handler = (request: { url: URL; method: string; headers: Headers; body: unknown }) => {
  status?: number
  body?: unknown
}

export interface MockApi {
  calls: { method: string; path: string; headers: Headers; body: unknown }[]
  on: (method: string, path: string, handler: Handler | { status?: number; body?: unknown }) => void
}

/** Remplace fetch par un petit serveur d'API simulé : aucune requête réseau réelle dans les tests. */
export function mockApi(): MockApi {
  const handlers = new Map<string, Handler>()
  const calls: MockApi['calls'] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost')
      const method = (init?.method ?? 'GET').toUpperCase()
      const path = url.pathname.replace(/^\/api\/v1/, '')
      const headers = new Headers(init?.headers)
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, path, headers, body })

      const handler = handlers.get(`${method} ${path}`)
      if (!handler) {
        return new Response(JSON.stringify({ message: `Non simulé : ${method} ${path}` }), {
          status: 404,
        })
      }
      const result = handler({ url, method, headers, body })
      return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  return {
    calls,
    on(method, path, handler) {
      handlers.set(`${method} ${path}`, typeof handler === 'function' ? handler : () => handler)
    },
  }
}

/** Monte des routes avec les fournisseurs applicatifs ; `signedIn` simule une session déjà ouverte. */
export function renderRoutes(
  routes: RouteObject[],
  options: { route?: string; signedIn?: AuthUser } = {},
) {
  if (options.signedIn) authStorage.set('test-token')
  const router = createMemoryRouter(routes, { initialEntries: [options.route ?? '/'] })
  const view = render(
    <Providers client={createQueryClient()}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { router, ...view }
}
