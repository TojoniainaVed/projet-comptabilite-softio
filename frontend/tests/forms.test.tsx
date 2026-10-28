import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Providers } from '@/app/providers'
import { createQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { PayInvoiceModal } from '@/features/invoices/PayInvoiceModal'
import type { Invoice } from '@/types/api'
import { makeUser, mockApi, renderRoutes } from './helpers'

afterEach(() => vi.unstubAllGlobals())

const listOf = (data: unknown[]) => ({ body: { data } })
const accounts = [
  { id: 10, code: '512', name: 'Banque', type: 'asset', category: 'bank', is_active: true },
  { id: 11, code: '706', name: 'Ventes', type: 'income', category: null, is_active: true },
]

describe("formulaire d'écriture", () => {
  function setup() {
    const server = mockApi()
    const user = makeUser({ permissions: ['entries.view', 'entries.create'] })
    server.on('GET', '/auth/me', { body: { data: user } })
    server.on('GET', '/accounts', listOf(accounts))
    server.on(
      'GET',
      '/journals',
      listOf([
        { id: 1, code: 'OD', name: 'Opérations diverses', type: 'general', is_active: true },
      ]),
    )
    return { server, user }
  }

  it("indique en direct l'écart débit / crédit puis l'équilibre", async () => {
    const { user } = setup()
    renderRoutes(routes, { route: '/journal-entries/new', signedIn: user })
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Saisissez les montants')

    await userEvent.type(screen.getByLabelText('Débit, ligne 1'), '150.50')
    await userEvent.type(screen.getByLabelText('Crédit, ligne 2'), '100')
    expect(status).toHaveTextContent('Écart débit / crédit : 50,50')
    expect(screen.getByTestId('total-debit')).toHaveTextContent('150,50')

    await userEvent.clear(screen.getByLabelText('Crédit, ligne 2'))
    await userEvent.type(screen.getByLabelText('Crédit, ligne 2'), '150,50')
    expect(status).toHaveTextContent('Écriture équilibrée.')
  })

  it("bloque l'envoi tant que les champs obligatoires sont vides", async () => {
    const { server, user } = setup()
    renderRoutes(routes, { route: '/journal-entries/new', signedIn: user })
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le brouillon' }))
    expect(await screen.findByText('Choisissez un journal.')).toBeInTheDocument()
    expect(screen.getByText('Le libellé est obligatoire.')).toBeInTheDocument()
    expect(screen.getAllByText('Choisissez un compte.')).toHaveLength(2)
    expect(server.calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('refuse une ligne à la fois au débit et au crédit', async () => {
    const { user } = setup()
    renderRoutes(routes, { route: '/journal-entries/new', signedIn: user })
    await userEvent.type(await screen.findByLabelText('Débit, ligne 1'), '10')
    await userEvent.type(screen.getByLabelText('Crédit, ligne 1'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))
    expect(
      await screen.findByText('Une ligne ne peut pas être à la fois au débit et au crédit.'),
    ).toBeInTheDocument()
  })

  it('envoie des montants sous forme de chaînes décimales et des identifiants numériques', async () => {
    const { server, user } = setup()
    server.on('POST', '/journal-entries', { status: 201, body: { data: { id: 9 } } })
    server.on('GET', '/journal-entries/9', {
      body: {
        data: {
          id: 9,
          reference: null,
          journal: { id: 1, code: 'OD', name: 'OD' },
          entry_date: '2026-03-05',
          description: 'Apport',
          status: 'draft',
          source_type: null,
          source_id: null,
          reversal_of_id: null,
          reversed_at: null,
          posted_at: null,
          lines: [],
        },
      },
    })
    renderRoutes(routes, { route: '/journal-entries/new', signedIn: user })

    await screen.findAllByRole('option', { name: /512 — Banque/ })
    await userEvent.selectOptions(screen.getByLabelText(/^Journal/), '1')
    await userEvent.type(screen.getByRole('textbox', { name: 'Libellé' }), 'Apport')
    await userEvent.selectOptions(screen.getByLabelText('Compte, ligne 1'), '10')
    await userEvent.type(screen.getByLabelText('Débit, ligne 1'), '1000,5')
    await userEvent.selectOptions(screen.getByLabelText('Compte, ligne 2'), '11')
    await userEvent.type(screen.getByLabelText('Crédit, ligne 2'), '1000.50')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))

    await waitFor(() =>
      expect(server.calls.some((c) => c.method === 'POST' && c.path === '/journal-entries')).toBe(
        true,
      ),
    )
    const body = server.calls.find((c) => c.method === 'POST')?.body as {
      journal_id: number
      lines: Record<string, unknown>[]
    }
    expect(body.journal_id).toBe(1)
    expect(body.lines[0]).toEqual({ account_id: 10, label: null, debit: '1000.5', credit: null })
    expect(body.lines[1]).toEqual({ account_id: 11, label: null, debit: null, credit: '1000.50' })
  })
})

describe('paiement et idempotence', () => {
  const invoice: Invoice = {
    id: 5,
    type: 'customer',
    number: 'VEN-000001',
    supplier_reference: null,
    partner_id: 2,
    invoice_date: '2026-03-01',
    due_date: '2026-03-31',
    status: 'posted',
    currency: 'MGA',
    subtotal: '100.00',
    tax_total: '20.00',
    total: '120.00',
    amount_paid: '0.00',
    amount_due: '120.00',
    notes: null,
    journal_entry_id: 1,
    posted_at: null,
  }

  function renderModal(open = true) {
    return render(
      <Providers client={createQueryClient()}>
        <PayInvoiceModal invoice={invoice} open={open} onClose={() => undefined} />
      </Providers>,
    )
  }

  async function fillAndSubmit() {
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer un paiement' })
    await within(dialog).findByRole('option', { name: /512 — Banque/, hidden: true })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Compte de trésorerie/), '10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  }

  it('réutilise la même clé d’idempotence lors d’une nouvelle tentative après un échec', async () => {
    const server = mockApi()
    server.on('GET', '/accounts', listOf(accounts))
    let attempt = 0
    server.on('POST', '/invoices/5/payments', () =>
      ++attempt === 1
        ? { status: 500, body: { message: 'Erreur serveur.' } }
        : { status: 201, body: { data: { id: 1 } } },
    )

    renderModal()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur serveur.')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(attempt).toBe(2))

    const keys = server.calls
      .filter((c) => c.path === '/invoices/5/payments')
      .map((c) => c.headers.get('Idempotency-Key'))
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[0]).toBe(keys[1])
  })

  it('envoie le montant normalisé et pré-rempli avec le reste dû', async () => {
    const server = mockApi()
    server.on('GET', '/accounts', listOf(accounts))
    server.on('POST', '/invoices/5/payments', { status: 201, body: { data: { id: 1 } } })
    renderModal()
    await fillAndSubmit()
    await waitFor(() => expect(server.calls.some((c) => c.method === 'POST')).toBe(true))
    expect(server.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      amount: '120.00',
      method: 'bank_transfer',
      treasury_account_id: 10,
    })
  })

  it('génère une nouvelle clé à chaque ouverture du formulaire', async () => {
    const server = mockApi()
    server.on('GET', '/accounts', listOf(accounts))
    server.on('POST', '/invoices/5/payments', { status: 201, body: { data: { id: 1 } } })

    const first = renderModal()
    await fillAndSubmit()
    await waitFor(() => expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(1))
    first.unmount()

    renderModal()
    await fillAndSubmit()
    await waitFor(() => expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(2))
    const [a, b] = server.calls
      .filter((c) => c.method === 'POST')
      .map((c) => c.headers.get('Idempotency-Key'))
    expect(a).not.toBe(b)
  })

  it('refuse un montant nul ou mal formé avant tout envoi', async () => {
    const server = mockApi()
    server.on('GET', '/accounts', listOf(accounts))
    renderModal()
    const dialog = await screen.findByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText(/Montant/))
    await userEvent.type(within(dialog).getByLabelText(/Montant/), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(
      await within(dialog).findByText('Le montant doit être supérieur à zéro.'),
    ).toBeInTheDocument()
    expect(server.calls.some((c) => c.method === 'POST')).toBe(false)
  })
})
