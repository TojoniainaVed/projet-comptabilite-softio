import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Monitor, Moon, RotateCcw, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatusBadge } from '@/components/ui/StatusBadges'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/features/preferences/usePreferences'
import {
  accentOptions,
  densityOptions,
  fontSizeOptions,
  sidebarOptions,
  statusColorOptions,
  statusOptions,
  themeOptions,
} from '@/features/preferences/preferences'
import type { ThemeMode } from '@/types/api'
import './themes.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const themeIcons: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

/** Panneau latéral « Personnaliser » : les réglages s'appliquent immédiatement et sont enregistrés dans le compte. */
export function PreferencesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preferences, update, reset } = usePreferences()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface text-ink shadow-overlay"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              Personnaliser
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Vos réglages sont enregistrés dans votre compte.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer le panneau"
            onClick={onClose}
            className="rounded-control p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Group title="Thème">
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = themeIcons[option.value]
                return (
                  <Choice
                    key={option.value}
                    name="pref-theme"
                    label={option.label}
                    checked={preferences.theme === option.value}
                    onSelect={() => update({ theme: option.value })}
                    className="flex-col gap-1.5 py-3"
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {option.label}
                  </Choice>
                )
              })}
            </div>
          </Group>

          <Group title="Couleur d'accent">
            <div className="flex flex-wrap gap-3">
              {accentOptions.map((option) => (
                <Swatch
                  key={option.value}
                  name="pref-accent"
                  label={option.label}
                  color={option.swatch}
                  checked={preferences.accent === option.value}
                  onSelect={() => update({ accent: option.value })}
                />
              ))}
            </div>
          </Group>

          <Group title="Menu latéral">
            <div className="flex flex-wrap gap-3">
              {sidebarOptions.map((option) => (
                <Swatch
                  key={option.value}
                  name="pref-sidebar"
                  label={option.label}
                  color={option.swatch}
                  checked={preferences.sidebar === option.value}
                  onSelect={() => update({ sidebar: option.value })}
                />
              ))}
            </div>
            <div className="mt-3">
              <Checkbox
                label="Réduire le menu latéral (icônes seules)"
                checked={preferences.sidebar_collapsed}
                onChange={(event) => update({ sidebar_collapsed: event.target.checked })}
              />
            </div>
          </Group>

          <Group title="Densité des tableaux">
            <div className="grid grid-cols-2 gap-2">
              {densityOptions.map((option) => (
                <Choice
                  key={option.value}
                  name="pref-density"
                  label={option.label}
                  checked={preferences.density === option.value}
                  onSelect={() => update({ density: option.value })}
                >
                  {option.label}
                </Choice>
              ))}
            </div>
          </Group>

          <Group title="Couleurs des statuts">
            <div className="space-y-3">
              {statusOptions.map((status) => (
                <div key={status.key} className="space-y-1.5">
                  <StatusBadge status={status.key} label={status.label} />
                  <div className="flex flex-wrap gap-2">
                    {statusColorOptions.map((option) => (
                      <Swatch
                        key={option.value}
                        name={`pref-status-${status.key}`}
                        label={`${status.label} : ${option.label}`}
                        color={option.hex}
                        small
                        checked={preferences.status_colors[status.key] === option.value}
                        onSelect={() =>
                          update({
                            status_colors: {
                              ...preferences.status_colors,
                              [status.key]: option.value,
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Group>

          <Group title="Taille du texte">
            <div className="grid grid-cols-3 gap-2">
              {fontSizeOptions.map((option) => (
                <Choice
                  key={option.value}
                  name="pref-font"
                  label={option.label}
                  checked={preferences.font_size === option.value}
                  onSelect={() => update({ font_size: option.value })}
                >
                  {option.label}
                </Choice>
              ))}
            </div>
          </Group>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={reset}
          >
            Réinitialiser
          </Button>
          <Button size="sm" onClick={onClose}>
            Terminé
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

/** Choix exclusif : un vrai bouton radio (clavier et lecteur d'écran) habillé en carte. */
function Choice({
  name,
  label,
  checked,
  onSelect,
  className,
  children,
}: {
  name: string
  label: string
  checked: boolean
  onSelect: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-control border px-3 py-2 text-sm font-medium transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-line text-ink-muted hover:bg-canvas hover:text-ink',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        aria-label={label}
        className="sr-only"
      />
      {children}
    </label>
  )
}

function Swatch({
  name,
  label,
  color,
  checked,
  onSelect,
  small = false,
}: {
  name: string
  label: string
  color: string
  checked: boolean
  onSelect: () => void
  small?: boolean
}) {
  return (
    <label
      title={label}
      className={cn(
        'relative flex cursor-pointer items-center justify-center rounded-full border border-line',
        small ? 'size-6' : 'size-9',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked && 'ring-2 ring-brand-600 ring-offset-2 ring-offset-surface',
      )}
      style={{ backgroundColor: color }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        aria-label={label}
        className="sr-only"
      />
      {checked && (
        <Check
          className={cn(small ? 'size-3.5' : 'size-4', 'text-white mix-blend-difference')}
          aria-hidden="true"
        />
      )}
    </label>
  )
}
