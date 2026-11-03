import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import {
  Building2,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  Users,
  ArrowLeftRight,
} from 'lucide-react'
import { Shell, type NavItem } from '@/layouts/Shell'
import { useAuth } from '@/features/auth/AuthProvider'

const nav: NavItem[] = [
  {
    to: '/admin',
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    permission: 'users.view',
    end: true,
  },
  { to: '/admin/users', label: 'Utilisateurs', icon: Users, permission: 'users.view' },
  { to: '/admin/roles', label: 'Rôles et permissions', icon: KeyRound, permission: 'roles.view' },
  { to: '/admin/companies', label: 'Entreprises', icon: Building2, permission: 'companies.view' },
  { to: '/admin/settings', label: 'Paramètres', icon: Settings, permission: 'settings.view' },
  {
    to: '/admin/audit-logs',
    label: "Journal d'audit",
    icon: ClipboardList,
    permission: 'audit.view',
  },
  {
    to: '/admin/sessions',
    label: 'Sessions',
    icon: MonitorSmartphone,
    permission: 'sessions.view',
  },
]

export function AdminLayout() {
  const { isPlatformAdmin } = useAuth()
  return (
    <Shell
      tone="dark"
      nav={nav}
      brand={
        <span className="flex items-center gap-2">
          <span className="rounded-control bg-white px-2 py-1">
            <Logo className="h-6" />
          </span>
          Administration
        </span>
      }
      footerLink={
        !isPlatformAdmin ? (
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Retour à la comptabilité
          </Link>
        ) : undefined
      }
    />
  )
}
