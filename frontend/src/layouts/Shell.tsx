import { useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  /** Permission requise pour afficher l'entrée (commodité d'affichage uniquement). */
  permission?: string
  end?: boolean
}

interface ShellProps {
  brand: ReactNode
  nav: NavItem[]
  tone: 'light' | 'dark'
  footerLink?: ReactNode
}

/** Structure commune des deux espaces : barre latérale, en-tête mobile, zone de contenu. */
export function Shell({ brand, nav, tone, footerLink }: ShellProps) {
  const { user, logout, can } = useAuth()
  const [open, setOpen] = useState(false)

  const dark = tone === 'dark'
  const visible = nav.filter((item) => !item.permission || can(item.permission))

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
        {visible.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
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
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
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
              className="absolute top-3 right-3 z-10 rounded-control p-1 text-current opacity-70 hover:opacity-100"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main id="contenu" className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
