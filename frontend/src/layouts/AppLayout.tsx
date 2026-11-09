import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import {
  BookOpen,
  FileText,
  FileUser,
  Landmark,
  LayoutDashboard,
  ListTree,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  BarChart3,
} from 'lucide-react'
import { Shell, type NavItem } from '@/layouts/Shell'
import { useAuth } from '@/features/auth/AuthProvider'

const nav: NavItem[] = [
  {
    to: '/',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    permission: 'reports.view',
    end: true,
  },
  { to: '/accounts', label: 'Plan comptable', icon: ListTree, permission: 'accounts.view' },
  { to: '/journal-entries', label: 'Écritures', icon: BookOpen, permission: 'entries.view' },
  { to: '/customers', label: 'Clients', icon: Users, permission: 'partners.view' },
  { to: '/suppliers', label: 'Fournisseurs', icon: Truck, permission: 'partners.view' },
  // duex factures dans un menu
  {
    label: 'Factures',
    icon: FileText,
    permission: 'invoices.view',
    children: [
      {
        to: '/sales/invoices',
        label: 'Factures clients',
        icon: FileUser,
        permission: 'invoices.view',
      },
      {
        to: '/purchases/invoices',
        label: 'Factures fournisseurs',
        icon: FileText,
        permission: 'invoices.view',
      },
    ],
  },
  { to: '/payments', label: 'Paiements', icon: Wallet, permission: 'payments.view' },
  { to: '/treasury', label: 'Trésorerie', icon: Landmark, permission: 'reports.view' },
  { to: '/expenses', label: 'Dépenses', icon: Receipt, permission: 'expenses.view' },
  { to: '/reports', label: 'Rapports', icon: BarChart3, permission: 'reports.view' },
  { to: '/settings', label: 'Paramètres comptables', icon: Settings, permission: 'journals.view' },
]

export function AppLayout() {
  const { can } = useAuth()
  const showAdmin = [
    'users.view',
    'roles.view',
    'settings.view',
    'audit.view',
    'sessions.view',
  ].some(can)

  return (
    <Shell
      tone="light"
      nav={nav}
      brand={
        <span className="flex items-center gap-2">
          <Logo className="h-8" />
          <span className="text-xs font-medium text-ink-muted">Comptabilité</span>
        </span>
      }
      footerLink={
        showAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            Espace administration
          </Link>
        ) : undefined
      }
    />
  )
}
