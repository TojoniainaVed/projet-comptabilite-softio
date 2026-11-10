import { useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'

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
  nav: NavItem[]
  tone: 'light' | 'dark'
  footerLink?: ReactNode
}

export function Shell({ brand, nav, tone, footerLink }: ShellProps) {
  const { user, logout, can } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const dark = tone === 'dark'

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

  // Ouvre automatiquement le sous-menu correspondant à la page active (à chaque changement de page).
  const [expanded, setExpanded] = useState<string | null>(activeParentLabel)
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (activeParentLabel) setExpanded(activeParentLabel)
  }

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
      dark
        ? isActive
          ? 'bg-white/15 text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
        : isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-ink-muted hover:bg-canvas hover:text-ink',
    )

  const sidebar = (
    <div
      className={cn(
        'flex h-full flex-col',
        dark ? 'bg-admin text-white' : 'border-r border-line bg-surface text-ink',
      )}
    >
      <div className="flex h-14 items-center px-5 font-semibold">{brand}</div>

      <nav
        aria-label="Navigation principale"
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
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
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-line pl-2">
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
                                  ? 'bg-brand-50 text-brand-700'
                                  : 'text-ink-muted hover:bg-canvas hover:text-ink',
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
              className={({ isActive }) => linkClass(isActive)}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          ) : null
        })}
      </nav>

      <div
        className={cn(
          'space-y-2 border-t px-4 py-3 text-sm',
          dark ? 'border-white/10' : 'border-line',
        )}
      >
        {footerLink}
        <div className="min-w-0">
          <p className="truncate font-medium">{user?.name}</p>
          <p className={cn('truncate text-xs', dark ? 'text-white/60' : 'text-ink-muted')}>
            {user?.role.name}
            {user?.company ? ` · ${user.company.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className={cn(
            'flex items-center gap-2 text-xs font-medium',
            dark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-ink',
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Se déconnecter
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-control p-1.5 text-ink hover:bg-canvas"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="font-semibold text-ink">{brand}</span>
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
            {sidebar}
          </div>
        </div>
      )}

      <main id="contenu" className="min-w-0 w-full lg:pl-64">
        <div className="w-full min-w-0 px-3 py-4 sm:px-4 lg:px-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
