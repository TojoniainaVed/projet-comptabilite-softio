import { authStorage } from '@/lib/auth-storage'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>

/** Erreur renvoyée par l'API, avec le détail de validation (422) et le code métier éventuel. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isValidation(): boolean {
    return this.status === 422 && Object.keys(this.errors).length > 0
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Appelé quand l'API répond 401 sur une session authentifiée (jeton expiré ou révoqué). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: QueryParams
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: { message?: string; code?: string; errors?: Record<string, string[]> } = {}
  try {
    payload = await response.json()
  } catch {
    /* corps vide ou non JSON */
  }
  const fallback: Record<number, string> = {
    401: 'Votre session a expiré. Veuillez vous reconnecter.',
    403: "Vous n'avez pas les droits nécessaires pour cette action.",
    404: 'Ressource introuvable.',
    429: 'Trop de tentatives. Réessayez dans un instant.',
  }
  return new ApiError(
    payload.message ?? fallback[response.status] ?? `Erreur serveur (${response.status}).`,
    response.status,
    payload.code,
    payload.errors,
  )
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const token = authStorage.get()
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0)
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (response.status === 401 && token) unauthorizedHandler?.()
    throw error
  }
  return response
}

async function json<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await request(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    json<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    json<T>(path, { method: 'POST', body: body ?? {}, headers }),
  put: <T>(path: string, body?: unknown) => json<T>(path, { method: 'PUT', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => json<T>(path, { method: 'PATCH', body: body ?? {} }),
  delete: <T = void>(path: string) => json<T>(path, { method: 'DELETE' }),

  /** Télécharge un fichier (export CSV) en conservant l'en-tête d'authentification. */
  async download(path: string, filename: string, query?: QueryParams): Promise<void> {
    const response = await request(path, { query, headers: { Accept: 'text/csv' } })
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}
