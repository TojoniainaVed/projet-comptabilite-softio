import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setUnauthorizedHandler } from '@/lib/api-client'
import { authStorage } from '@/lib/auth-storage'
import { mockApi } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

describe('api-client', () => {
  it("n'ajoute aucun en-tête d'autorisation sans jeton", async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: {} } })
    await api.get('/platform')
    expect(server.calls[0].headers.get('Authorization')).toBeNull()
    expect(server.calls[0].headers.get('Accept')).toBe('application/json')
  })

  it('envoie le jeton Bearer et les paramètres de requête non vides', async () => {
    authStorage.set('abc123')
    const server = mockApi()
    server.on('GET', '/accounts', { body: { data: [] } })
    await api.get('/accounts', { search: 'banque', page: 2, type: '', other: undefined })
    expect(server.calls[0].headers.get('Authorization')).toBe('Bearer abc123')
  })

  it('transforme une réponse 422 en ApiError avec le détail des champs', async () => {
    const server = mockApi()
    server.on('POST', '/accounts', {
      status: 422,
      body: { message: 'Données invalides.', errors: { code: ['Le code est déjà utilisé.'] } },
    })
    const error = await api.post('/accounts', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).isValidation).toBe(true)
    expect((error as ApiError).errors.code[0]).toBe('Le code est déjà utilisé.')
  })

  it("conserve le code métier d'une règle de gestion refusée", async () => {
    const server = mockApi()
    server.on('POST', '/journal-entries/4/post', {
      status: 422,
      body: { message: "L'écriture n'est pas équilibrée.", code: 'entry_unbalanced' },
    })
    const error = (await api.post('/journal-entries/4/post').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('entry_unbalanced')
    expect(error.isValidation).toBe(false)
  })

  it('signale une coupure réseau par une erreur explicite', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = (await api.get('/platform').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/joindre le serveur/)
  })

  it('appelle le gestionnaire de session expirée sur un 401 authentifié, mais pas sans jeton', async () => {
    const server = mockApi()
    server.on('GET', '/auth/me', { status: 401, body: { message: 'Unauthenticated.' } })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await api.get('/auth/me').catch(() => undefined)
    expect(handler).not.toHaveBeenCalled()

    authStorage.set('expired')
    await api.get('/auth/me').catch(() => undefined)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('renvoie undefined pour une réponse 204', async () => {
    const server = mockApi()
    server.on('DELETE', '/journal-entries/1', { status: 204 })
    await expect(api.delete('/journal-entries/1')).resolves.toBeUndefined()
  })
})
