import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { mockApi, renderRoutes } from './helpers'

afterEach(() => vi.unstubAllGlobals())

const platform = (overrides: Record<string, unknown> = {}) => ({
  body: {
    data: {
      platform_name: 'Softio',
      password_min_length: 12,
      registration_enabled: true,
      terms_url: null,
      ...overrides,
    },
  },
})

async function fillRegistration(overrides: { password?: string; confirm?: string } = {}) {
  await userEvent.type(await screen.findByLabelText(/Nom de l'entreprise/), 'Rakoto & Fils')
  await userEvent.type(screen.getByLabelText(/Votre nom/), 'Jean Rakoto')
  await userEvent.type(screen.getByLabelText(/Adresse e-mail/), 'jean@rakoto.test')
  await userEvent.type(
    screen.getByLabelText(/^Mot de passe/),
    overrides.password ?? 'Mot-de-passe-1234',
  )
  await userEvent.type(
    screen.getByLabelText(/Confirmation du mot de passe/),
    overrides.confirm ?? overrides.password ?? 'Mot-de-passe-1234',
  )
}

describe('inscription', () => {
  it("propose « Créer un compte » seulement quand l'inscription est ouverte", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    const { unmount } = renderRoutes(routes, { route: '/login' })
    expect(await screen.findByRole('link', { name: 'Créer un compte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toBeInTheDocument()
    unmount()

    server.on('GET', '/platform', platform({ registration_enabled: false }))
    renderRoutes(routes, { route: '/login' })
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(screen.queryByRole('link', { name: 'Créer un compte' })).not.toBeInTheDocument()
  })

  it('valide localement : champs vides, mot de passe faible, confirmation, conditions', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    renderRoutes(routes, { route: '/register' })

    await userEvent.click(await screen.findByRole('button', { name: 'Créer mon compte' }))
    expect(await screen.findByText("Le nom de l'entreprise est obligatoire.")).toBeInTheDocument()
    expect(
      screen.getByText("Vous devez accepter les conditions d'utilisation."),
    ).toBeInTheDocument()

    await fillRegistration({ password: 'court', confirm: 'autre' })
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    expect(await screen.findByText('Au moins 12 caractères.')).toBeInTheDocument()
    expect(server.calls.some((c) => c.path === '/auth/register')).toBe(false)
  })

  it('refuse deux mots de passe différents', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    renderRoutes(routes, { route: '/register' })

    await fillRegistration({ password: 'Mot-de-passe-1234', confirm: 'Mot-de-passe-9999' })
    await userEvent.click(screen.getByLabelText(/J'accepte/))
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(
      await screen.findByText('Les deux mots de passe ne correspondent pas.'),
    ).toBeInTheDocument()
    expect(server.calls.some((c) => c.path === '/auth/register')).toBe(false)
  })

  it("envoie l'inscription puis demande de confirmer l'e-mail", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/register', {
      status: 201,
      body: {
        message: 'Compte créé. Un e-mail de confirmation vient de vous être envoyé.',
        verification_required: true,
      },
    })
    renderRoutes(routes, { route: '/register' })

    await fillRegistration()
    await userEvent.click(screen.getByLabelText(/J'accepte/))
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(
      await screen.findByRole('heading', { name: 'Vérifiez votre boîte e-mail' }),
    ).toBeInTheDocument()
    expect(server.calls.find((c) => c.path === '/auth/register')?.body).toEqual({
      company_name: 'Rakoto & Fils',
      name: 'Jean Rakoto',
      email: 'jean@rakoto.test',
      password: 'Mot-de-passe-1234',
      password_confirmation: 'Mot-de-passe-1234',
      accept_terms: true,
    })
  })

  it("affiche l'erreur serveur sur le champ (e-mail déjà utilisé)", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/register', {
      status: 422,
      body: { message: 'Erreur', errors: { email: ['Cette adresse e-mail est déjà utilisée.'] } },
    })
    renderRoutes(routes, { route: '/register' })

    await fillRegistration()
    await userEvent.click(screen.getByLabelText(/J'accepte/))
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Cette adresse e-mail est déjà utilisée.')).toBeInTheDocument()
  })

  it("indique que les inscriptions sont fermées quand la plateforme l'a décidé", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform({ registration_enabled: false }))
    renderRoutes(routes, { route: '/register' })

    expect(await screen.findByRole('heading', { name: 'Inscriptions fermées' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).not.toBeInTheDocument()
  })
})

describe('confirmation et connexion', () => {
  it('affiche le résultat du lien de confirmation', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    renderRoutes(routes, { route: '/login?verified=1' })
    expect(await screen.findByText(/Adresse e-mail confirmée/)).toBeInTheDocument()
  })

  it("propose de renvoyer l'e-mail quand la connexion est bloquée faute de confirmation", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/login', {
      status: 422,
      body: {
        message: 'Confirmez votre adresse e-mail avant de vous connecter.',
        code: 'email_not_verified',
      },
    })
    server.on('POST', '/auth/email/resend', {
      status: 202,
      body: { message: "Un nouvel e-mail vient d'être envoyé." },
    })
    renderRoutes(routes, { route: '/login' })

    await userEvent.type(await screen.findByLabelText(/Adresse e-mail/), 'jean@rakoto.test')
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'Mot-de-passe-1234')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    await userEvent.click(
      await screen.findByRole('button', { name: "Renvoyer l'e-mail de confirmation" }),
    )

    expect(await screen.findByText("Un nouvel e-mail vient d'être envoyé.")).toBeInTheDocument()
    expect(server.calls.find((c) => c.path === '/auth/email/resend')?.body).toEqual({
      email: 'jean@rakoto.test',
    })
  })
})

describe('mot de passe oublié', () => {
  it('envoie la demande et affiche la réponse générique', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/password/forgot', {
      status: 202,
      body: { message: 'Si un compte existe, un e-mail est envoyé.' },
    })
    renderRoutes(routes, { route: '/forgot-password' })

    await userEvent.type(await screen.findByLabelText(/Adresse e-mail/), 'jean@rakoto.test')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(
      await screen.findByText('Si un compte existe, un e-mail est envoyé.'),
    ).toBeInTheDocument()
    expect(server.calls.find((c) => c.path === '/auth/password/forgot')?.body).toEqual({
      email: 'jean@rakoto.test',
    })
  })

  it('réinitialise le mot de passe puis renvoie vers la connexion', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/password/reset', { body: { message: 'Mot de passe modifié.' } })
    renderRoutes(routes, { route: '/reset-password?token=abc&email=jean%40rakoto.test' })

    await userEvent.type(
      await screen.findByLabelText(/^Nouveau mot de passe/),
      'Nouveau-mot-de-passe-77',
    )
    await userEvent.type(
      screen.getByLabelText(/Confirmation du mot de passe/),
      'Nouveau-mot-de-passe-77',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(
      await screen.findByText(/Connectez-vous avec le nouveau mot de passe/),
    ).toBeInTheDocument()
    expect(server.calls.find((c) => c.path === '/auth/password/reset')?.body).toEqual({
      token: 'abc',
      email: 'jean@rakoto.test',
      password: 'Nouveau-mot-de-passe-77',
      password_confirmation: 'Nouveau-mot-de-passe-77',
    })
  })

  it('signale un lien expiré renvoyé par le serveur', async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    server.on('POST', '/auth/password/reset', {
      status: 422,
      body: { message: 'Lien invalide.', code: 'invalid_reset_token' },
    })
    renderRoutes(routes, { route: '/reset-password?token=abc&email=jean%40rakoto.test' })

    await userEvent.type(
      await screen.findByLabelText(/^Nouveau mot de passe/),
      'Nouveau-mot-de-passe-77',
    )
    await userEvent.type(
      screen.getByLabelText(/Confirmation du mot de passe/),
      'Nouveau-mot-de-passe-77',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(
      await screen.findByRole('heading', { name: 'Lien invalide ou expiré' }),
    ).toBeInTheDocument()
  })

  it("refuse l'accès sans jeton", async () => {
    const server = mockApi()
    server.on('GET', '/platform', platform())
    renderRoutes(routes, { route: '/reset-password' })
    expect(
      await screen.findByRole('heading', { name: 'Lien invalide ou expiré' }),
    ).toBeInTheDocument()
  })
})
