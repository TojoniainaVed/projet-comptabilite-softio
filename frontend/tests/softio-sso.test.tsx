import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { authStorage } from '@/lib/auth-storage'
import { makeUser, mockApi, renderRoutes } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const dashboard = {
  treasury_total: '0.00',
  receivable_outstanding: '0.00',
  payable_outstanding: '0.00',
  revenue_this_month: '0.00',
  expenses_this_month: '0.00',
  draft_entries: 0,
  overdue_invoices: 0,
  monthly: [],
  recent_entries: [],
}

describe('connexion depuis Softio', () => {
  it('échange le code une seule fois, mémorise le jeton et ouvre le tableau de bord', async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('POST', '/auth/sso', {
      body: { token: 'tok_sso', user: makeUser({ permissions: ['reports.view'] }) },
    })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    renderRoutes(routes, { route: '/sso?code=abc123' })

    await waitFor(() => expect(authStorage.get()).toBe('tok_sso'))
    const echanges = server.calls.filter((c) => c.path === '/auth/sso')
    expect(echanges).toHaveLength(1)
    expect(echanges[0].body).toEqual({ code: 'abc123' })
  })

  it("affiche l'erreur de Softio et un lien vers la connexion classique", async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('POST', '/auth/sso', {
      status: 422,
      body: {
        message: "Votre abonnement au module Comptabilité n'est pas actif.",
        code: 'softio_access_inactive',
      },
    })
    renderRoutes(routes, { route: '/sso?code=abc123' })

    expect(
      await screen.findByText("Votre abonnement au module Comptabilité n'est pas actif."),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /compte comptable/ })).toBeInTheDocument()
    expect(authStorage.get()).toBeNull()
  })

  it("signale un lien sans code sans appeler l'API", async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    renderRoutes(routes, { route: '/sso' })

    expect(await screen.findByText(/Lien de connexion incomplet/)).toBeInTheDocument()
    expect(server.calls.some((c) => c.path === '/auth/sso')).toBe(false)
  })
})

describe('déconnexion', () => {
  it('ramène vers Softio un compte venu de Softio', async () => {
    const softio = await import('@/lib/softio')
    const retour = vi.spyOn(softio, 'retournerVersSoftio').mockImplementation(() => {})
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('POST', '/auth/sso', {
      body: {
        token: 'tok_sso',
        user: makeUser({ permissions: ['reports.view'], from_softio: true }),
      },
    })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    server.on('POST', '/auth/logout', { status: 204 })
    renderRoutes(routes, { route: '/sso?code=abc123' })

    await userEvent.click(await screen.findByRole('button', { name: /Déconnexion|Se déconnecter/ }))

    await waitFor(() => expect(retour).toHaveBeenCalledOnce())
    expect(authStorage.get()).toBeNull()
  })

  it('laisse un compte local sur la page de connexion de Compta', async () => {
    const softio = await import('@/lib/softio')
    const retour = vi.spyOn(softio, 'retournerVersSoftio').mockImplementation(() => {})
    authStorage.set('tok_local')
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('GET', '/auth/me', { body: { data: makeUser({ permissions: ['reports.view'] }) } })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    server.on('POST', '/auth/logout', { status: 204 })
    renderRoutes(routes, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: /Déconnexion|Se déconnecter/ }))

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(retour).not.toHaveBeenCalled()
  })
})
