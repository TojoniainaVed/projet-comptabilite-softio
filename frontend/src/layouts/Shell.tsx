import { useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, Palette, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { PreferencesPanel } from '@/features/preferences/PreferencesPanel'
import {
  useForceLightTheme,
  useHydratePreferences,
  usePreferences,
} from '@/features/preferences/usePreferences'

type NavIcon = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true'
}>

export interface NavSubItem {
  to: string
  label: string
  icon: NavIcon
  permission?: string
  end?: boolean
}

export interface NavItem {
  to?: string
  label: string
  icon: NavIcon
  permission?: string
  end?: boolean
  children?: NavSubItem[]
}

interface ShellProps {
  brand: ReactNode
  /** Marque affichée quand le menu est réduit (icône seule). */
  brandCompact?: ReactNode
  nav: NavItem[]
  tone: 'light' | 'dark'
  footerLink?: ReactNode
  className?: string
}

export function Shell({ brand, brandCompact, nav, tone, footerLink, className }: ShellProps) {
  const { user, logout, can } = useAuth()
  const [open, setOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const location = useLocation()
  const { preferences, update } = usePreferences()

  const dark = tone === 'dark'
  const collapsed = !dark && preferences.sidebar_collapsed

  // Les préférences du compte s'appliquent à la connexion ; l'administration reste en thème clair.
  useHydratePreferences(user?.id, user?.preferences)
  useForceLightTheme(dark)

  const visible = nav
    .filter((item) => !item.permission || can(item.permission))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => !child.permission || can(child.permission)),
    }))

  const activeParentLabel =
    visible.find((item) =>
      item.children?.some(
        (child) => location.pathname === child.to || location.pathname.startsWith(`${child.to}/`),
      ),
    )?.label ?? null

  // À chaque changement de page : ouvre le sous-menu de la page active, et referme les autres.
  const [expanded, setExpanded] = useState<string | null>(activeParentLabel)
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setExpanded(activeParentLabel)
  }

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
      dark
        ? isActive
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
        : isActive
          ? 'bg-[var(--sb-active-bg)] text-[color:var(--sb-active-fg)]'
          : 'text-[color:var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[color:var(--sb-fg)]',
    )

  // Étiquettes masquées visuellement (mais lues par les lecteurs d'écran) quand le menu est réduit.
  const labelClass = 'group-data-[compact=true]/sb:sr-only'

  const renderSidebar = (compact: boolean) => (
    <div
      data-compact={compact}
      className={cn(
        'group/sb flex h-full flex-col',
        dark
          ? 'bg-admin text-white'
          : 'softio-sidebar border-r border-[color:var(--sb-line)] bg-[var(--sb-bg)] text-[color:var(--sb-fg)]',
      )}
    >
      <div
        className={cn(
          'sb-brand flex h-14 items-center font-semibold',
          compact ? 'justify-center px-2' : 'px-5',
        )}
      >
        {compact && brandCompact ? brandCompact : brand}
      </div>

      <nav
        aria-label="Navigation principale"
        className={cn('flex-1 space-y-0.5 overflow-y-auto py-2', compact ? 'px-2' : 'px-3')}
      >
        {visible.map((item) => {
          const Icon = item.icon
          const hasChildren = Boolean(item.children?.length)

          if (hasChildren) {
            const isOpen = expanded === item.label
            const isChildActive = item.children!.some(
              (child) =>
                location.pathname === child.to || location.pathname.startsWith(`${child.to}/`),
            )

            // Menu réduit : pas de sous-menu déroulant, l'icône ouvre la première page du groupe.
            if (compact) {
              return (
                <NavLink
                  key={item.label}
                  to={item.children![0].to}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setOpen(false)}
                  className={cn(linkClass(isChildActive), 'justify-center px-0')}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">{item.label}</span>
                </NavLink>
              )
            }

            return (
              <div key={item.label}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : item.label)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-control px-3 py-2 text-sm font-medium transition-colors',
                    linkClass(isChildActive),
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div
                    className={cn(
                      'ml-5 mt-1 space-y-0.5 border-l pl-2',
                      dark ? 'border-line' : 'border-[color:var(--sb-line)]',
                    )}
                  >
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon

                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.end}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 rounded-control px-3 py-2 text-xs font-medium transition-colors',
                              dark
                                ? isActive
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                                : isActive
                                  ? 'bg-[var(--sb-active-bg)] text-[color:var(--sb-active-fg)]'
                                  : 'text-[color:var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[color:var(--sb-fg)]',
                            )
                          }
                        >
                          <ChildIcon className="size-4 shrink-0" aria-hidden="true" />
                          {child.label}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return item.to ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              title={compact ? item.label : undefined}
              aria-label={compact ? item.label : undefined}
              className={({ isActive }) =>
                cn(linkClass(isActive), compact && 'justify-center px-0')
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {compact ? <span className="sr-only">{item.label}</span> : item.label}
            </NavLink>
          ) : null
        })}
      </nav>

      <div
        className={cn(
          'space-y-2 border-t py-3 text-sm',
          compact ? 'px-2' : 'px-4',
          dark ? 'border-white/10' : 'border-[color:var(--sb-line)]',
        )}
      >
        {footerLink}
        <div className={cn('min-w-0', compact && 'sr-only')}>
          <p className="truncate font-medium">{user?.name}</p>
          <p
            className={cn(
              'truncate text-xs',
              dark ? 'text-white/60' : 'text-[color:var(--sb-muted)]',
            )}
          >
            {user?.role.name}
            {user?.company ? ` · ${user.company.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          title="Se déconnecter"
          className={cn(
            'flex items-center gap-2 text-xs font-medium',
            compact && 'w-full justify-center',
            dark
              ? 'text-white/70 hover:text-white'
              : 'text-[color:var(--sb-muted)] hover:text-[color:var(--sb-fg)]',
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className={labelClass}>Se déconnecter</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn('min-h-screen bg-canvas', dark && 'softio-admin-shell', className)}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 hidden lg:block',
          collapsed ? 'w-16' : 'w-64',
          dark && 'softio-admin-sidebar',
        )}
      >
        {renderSidebar(collapsed)}
        {!dark && (
          <button
            type="button"
            onClick={() => update({ sidebar_collapsed: !preferences.sidebar_collapsed })}
            aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
            title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
            className="absolute -right-3 top-4 z-30 flex size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-card hover:text-ink"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        )}
      </aside>

      <header className="softio-topbar sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-control p-1.5 text-ink hover:bg-canvas"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="sb-brand font-semibold text-ink">{brand}</span>
        {!dark && (
          <button
            type="button"
            aria-label="Personnaliser"
            onClick={() => setPanelOpen(true)}
            className="ml-auto rounded-control p-1.5 text-ink hover:bg-canvas"
          >
            <Palette className="size-5" aria-hidden="true" />
          </button>
        )}
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw]">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-control p-1 text-current opacity-70 hover:opacity-100"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {renderSidebar(false)}
          </div>
        </div>
      )}

      <main
        id="contenu"
        className={cn(
          'min-w-0 w-full',
          dark && 'softio-admin-main',
          collapsed ? 'lg:pl-16' : 'lg:pl-64',
        )}
      >
        {!dark && (
          <div className="hidden justify-end px-5 pt-3 lg:flex">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
            >
              <Palette className="size-4" aria-hidden="true" />
              Personnaliser
            </button>
          </div>
        )}
        <div className="w-full min-w-0 px-3 py-4 sm:px-4 lg:px-5">
          <Outlet />
        </div>
      </main>

      {!dark && <PreferencesPanel open={panelOpen} onClose={() => setPanelOpen(false)} />}
    </div>
  )
}
