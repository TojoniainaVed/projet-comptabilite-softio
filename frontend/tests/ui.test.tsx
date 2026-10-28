import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs } from '@/components/ui/Tabs'

interface Row {
  id: number
  name: string
}
const columns: Column<Row>[] = [{ key: 'name', header: 'Nom', cell: (r) => r.name }]

describe('DataTable', () => {
  it('affiche les lignes avec une légende accessible', () => {
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        rowKey={(r) => r.id}
      />,
    )
    expect(screen.getByRole('table', { name: 'Clients' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nom' })).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it("affiche l'état vide", () => {
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyTitle="Aucun client"
      />,
    )
    expect(screen.getByText('Aucun client')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it("affiche l'état d'erreur avec une action de reprise", async () => {
    const onRetry = vi.fn()
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={undefined}
        rowKey={(r) => r.id}
        error="Serveur indisponible"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Serveur indisponible')
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('affiche des squelettes pendant le chargement', () => {
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={undefined}
        loading
        rowKey={(r) => r.id}
      />,
    )
    expect(document.querySelector('tbody')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('tbody tr')).toHaveLength(5)
  })

  it('rend les lignes cliquables quand onRowClick est fourni', async () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        caption="Clients"
        columns={columns}
        rows={[{ id: 7, name: 'Beta' }]}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    )
    await userEvent.click(screen.getByText('Beta'))
    expect(onRowClick).toHaveBeenCalledWith({ id: 7, name: 'Beta' })
  })
})

describe('Modal', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Ouvrir</button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Mon dialogue"
          footer={<button>Valider</button>}
        >
          <input aria-label="Champ" />
        </Modal>
      </>
    )
  }

  it('expose un dialogue modal nommé, déplace le focus dedans et le restitue à la fermeture', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Ouvrir' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Mon dialogue' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('garde la tabulation à l’intérieur du dialogue', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })
})

describe('ConfirmDialog', () => {
  it('demande confirmation et propage les choix', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Supprimer"
        message="Êtes-vous sûr ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Supprimer' })
    expect(within(dialog).getByText('Êtes-vous sûr ?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it("désactive les boutons pendant l'opération", () => {
    render(
      <ConfirmDialog
        open
        title="Valider"
        message="..."
        loading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled()
  })
})

describe('FormField', () => {
  it('relie le libellé, le message d’erreur et le champ pour les lecteurs d’écran', () => {
    render(
      <FormField label="E-mail" error="Format invalide" required>
        {(control) => <Input {...control} />}
      </FormField>,
    )
    const input = screen.getByLabelText(/E-mail/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Format invalide')
    expect(screen.getByRole('alert')).toHaveTextContent('Format invalide')
  })
})

describe('Pagination', () => {
  it('navigue entre les pages et désactive les bornes', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        meta={{ current_page: 1, last_page: 3, per_page: 15, total: 40 }}
        onPageChange={onPageChange}
      />,
    )
    expect(screen.getByRole('button', { name: /Précédent/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("n'affiche pas de navigation pour une seule page", () => {
    render(
      <Pagination
        meta={{ current_page: 1, last_page: 1, per_page: 15, total: 3 }}
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByText('3 résultats')).toBeInTheDocument()
  })
})

describe('SearchInput', () => {
  it('ne déclenche la recherche qu’après la pause de saisie', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} delay={300} />)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'abc')
    expect(onChange).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(350)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abc')
    vi.useRealTimers()
  })
})

describe('Tabs', () => {
  it('change de panneau au clic et aux flèches', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [active, setActive] = useState('a')
      return (
        <Tabs
          active={active}
          onChange={setActive}
          tabs={[
            { id: 'a', label: 'Onglet A', content: <p>Contenu A</p> },
            { id: 'b', label: 'Onglet B', content: <p>Contenu B</p> },
          ]}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Onglet A' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Onglet A' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Onglet B' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Contenu B')
  })
})
