import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { usePlatform } from '@/features/auth/usePlatform'

/** Pages publiques (connexion, inscription…) : panneau de marque à gauche, formulaire à droite. */
export function AuthLayout() {
  const platform = usePlatform()
  const name = platform?.platform_name ?? 'Softio Comptabilité'

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[54fr_46fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-admin to-brand-500 px-[9%] py-16 text-white lg:flex">
        <div className="relative z-10 w-fit rounded-card bg-white px-6 py-3.5 shadow-overlay  top-40 left-5">
          <Logo className="h-18" />
        </div>
        <div className="relative z-10 max-w-md">
          <p className="mb-5 text-5xl leading-tight font-bold">
            La comptabilité de votre entreprise, en toute clarté.
          </p>
          <p className="text-base leading-relaxed text-white/80">
            Écritures, factures, paiements et rapports réunis dans un seul espace de travail.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/70">
          © {new Date().getFullYear()} {name}
        </p>
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-48 size-115 rounded-full border border-white/15 shadow-[0_0_0_48px_rgb(255_255_255/0.035),0_0_0_98px_rgb(255_255_255/0.025)]"
        />
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center border-b border-line bg-surface px-6 py-4 lg:hidden">
          <Logo className="h-9" />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-9">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}