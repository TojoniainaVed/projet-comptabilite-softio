import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { authStorage } from '@/lib/auth-storage'
import { makeUser, mockApi, renderRoutes } from './helpers'

afterEach(() => vi.unstubAllGlobals())

const dashboard = {
  treasury_total: '1000.00',
  receivable_outstanding: '0.00',
  payable_outstanding: '0.00',
  revenue_this_month: '0.00',
  expenses_this_month: '0.00',
  draft_entries: 2,
  overdue_invoices: 0,
  monthly: [],
  recent_entries: [],
}

describe('connexion', () => {
  it('affiche les erreurs de validation locales sans appeler le serveur', async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    renderRoutes(routes, { route: '/login' })

    await userEvent.click(await screen.findByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText("L'e-mail est obligatoire.")).toBeInTheDocument()
    expect(screen.getByText('Le mot de passe est obligatoire.')).toBeInTheDocument()
    expect(server.calls.some((c) => c.path === '/auth/login')).toBe(false)
  })

  it("affiche l'erreur renvoyée par l'API sans révéler si le compte existe", async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('POST', '/auth/login', {
      status: 422,
      body: { message: 'Identifiants invalides.', errors: { email: ['Identifiants invalides.'] } },
    })
    renderRoutes(routes, { route: '/login' })

    await userEvent.type(await screen.findByLabelText(/Adresse e-mail/), 'quelquun@example.test')
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument()
    expect(authStorage.get()).toBeNull()
  })

  it('ouvre la session, mémorise le jeton et affiche le tableau de bord', async () => {
    const user = makeUser({ permissions: ['reports.view'] })
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    server.on('POST', '/auth/login', { body: { token: 'tok_123', user } })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    renderRoutes(routes, { route: '/login' })

    await userEvent.type(await screen.findByLabelText(/Adresse e-mail/), 'rina@example.test')
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'Mot-de-passe-1234')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument()
    expect(authStorage.get()).toBe('tok_123')
    expect(server.calls.find((c) => c.path === '/auth/login')?.body).toEqual({
      email: 'rina@example.test',
      password: 'Mot-de-passe-1234',
      device_name: 'web',
    })
  })
})

describe('gardes de routes', () => {
  it('redirige un visiteur anonyme vers la connexion', async () => {
    const server = mockApi()
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    const { router } = renderRoutes(routes, { route: '/accounts' })
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('refuse (403) une page dont la permission manque', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['reports.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    renderRoutes(routes, { route: '/accounts', signedIn: user })
    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
  })

  it('autorise la page lorsque la permission est présente', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['accounts.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    server.on('GET', '/accounts', {
      body: {
        data: [
          { id: 1, code: '512', name: 'Banque', type: 'asset', category: 'bank', is_active: true },
        ],
        meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
      },
    })
    renderRoutes(routes, { route: '/accounts', signedIn: user })
    expect(await screen.findByText('512')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Liste des comptes' })).toBeInTheDocument()
  })

  it('masque les entrées de menu non autorisées', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['reports.view', 'accounts.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    renderRoutes(routes, { route: '/', signedIn: user })
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' })
    expect(nav).toHaveTextContent('Plan comptable')
    expect(nav).not.toHaveTextContent('Factures clients')
    expect(nav).not.toHaveTextContent('Dépenses')
  })

  it("redirige un compte de plateforme vers l'administration, sans accès comptable", async () => {
    const server = mockApi()
    const admin = makeUser({
      company: null,
      role: { id: 1, slug: 'super-admin', name: 'Super administrateur', scope: 'platform' },
      permissions: ['users.view'],
    })
    server.on('GET', '/auth/me', { body: { data: admin } })
    server.on('GET', '/admin/dashboard', {
      body: {
        data: {
          scope: 'platform',
          users_total: 3,
          users_active: 3,
          companies_total: 1,
          active_sessions: 1,
          recent_logins: [],
          recent_activity: [],
          logins_by_day: [],
          alerts: [],
        },
      },
    })
    const { router } = renderRoutes(routes, { route: '/', signedIn: admin })
    expect(
      await screen.findByRole('heading', { name: 'Administration', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
  })

  it("refuse l'espace d'administration à un compte sans permission d'administration", async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['reports.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    renderRoutes(routes, { route: '/admin/users', signedIn: user })
    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
  })

  it('vide la session quand le jeton stocké est rejeté', async () => {
    const server = mockApi()
    server.on('GET', '/auth/me', { status: 401, body: { message: 'Unauthenticated.' } })
    server.on('GET', '/platform', { body: { data: { platform_name: 'Softio' } } })
    authStorage.set('revoked')
    const { router } = renderRoutes(routes, { route: '/' })
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(router.state.location.pathname).toBe('/login')
    await waitFor(() => expect(authStorage.get()).toBeNull())
  })

  it('affiche une page 404 pour une adresse inconnue', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['reports.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    renderRoutes(routes, { route: '/introuvable', signedIn: user })
    expect(await screen.findByText('Page introuvable')).toBeInTheDocument()
  })
})

describe("page d'accueil selon le rôle", () => {
  it('ouvre le tableau de bord quand les rapports sont accessibles', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['reports.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    server.on('GET', '/dashboard', { body: { data: dashboard } })
    const { router } = renderRoutes(routes, { route: '/', signedIn: user })
    await screen.findByRole('heading', { name: 'Tableau de bord' })
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('redirige vers la première page autorisée pour un rôle sans rapports (facturation)', async () => {
    const server = mockApi()
    const user = makeUser({ permissions: ['invoices.view', 'partners.view', 'payments.view'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    server.on('GET', '/invoices', {
      body: { data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } },
    })
    const { router } = renderRoutes(routes, { route: '/', signedIn: user })
    await screen.findByRole('heading', { name: 'Factures clients' })
    expect(router.state.location.pathname).toBe('/sales/invoices')
  })

  it("affiche un accès refusé si le rôle n'a aucune page comptable", async () => {
    const server = mockApi()
    const user = makeUser({ permissions: [] })
    server.on('GET', '/auth/me', { body: { data: user } })
    renderRoutes(routes, { route: '/', signedIn: user })
    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
  })
})
