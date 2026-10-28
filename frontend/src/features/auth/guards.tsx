import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ForbiddenPage } from '@/features/auth/ErrorPages'

/** Exige une session ouverte ; sinon redirige vers la connexion en mémorisant la destination. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading)
    return <LoadingSpinner label="Vérification de la session…" className="min-h-screen" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Espace comptable : réservé aux comptes rattachés à une entreprise. */
export function RequireCompany() {
  const { isPlatformAdmin } = useAuth()
  if (isPlatformAdmin) return <Navigate to="/admin" replace />
  return <Outlet />
}

/** Garde de route par permission. L'affichage est une commodité : l'API reste l'autorité. */
export function RequirePermission({ permission }: { permission: string }) {
  const { can } = useAuth()
  return can(permission) ? <Outlet /> : <ForbiddenPage />
}

/** Espace d'administration : au moins la consultation des utilisateurs, rôles ou paramètres. */
export function RequireAdminAccess() {
  const { can } = useAuth()
  const allowed = [
    'users.view',
    'roles.view',
    'companies.view',
    'settings.view',
    'audit.view',
    'sessions.view',
  ].some(can)
  return allowed ? <Outlet /> : <ForbiddenPage />
}

/** Pages d'accueil possibles, par ordre de préférence : la première autorisée est ouverte. */
const LANDING: [permission: string, path: string][] = [
  ['reports.view', '/dashboard'],
  ['entries.view', '/journal-entries'],
  ['invoices.view', '/sales/invoices'],
  ['partners.view', '/customers'],
  ['payments.view', '/payments'],
  ['expenses.view', '/expenses'],
  ['accounts.view', '/accounts'],
]

/** Racine de l'espace comptable : ouvre le tableau de bord, ou la première page accessible au rôle. */
export function HomeRedirect() {
  const { can } = useAuth()
  const target = LANDING.find(([permission]) => can(permission))
  return target ? <Navigate to={target[1]} replace /> : <ForbiddenPage />
}
