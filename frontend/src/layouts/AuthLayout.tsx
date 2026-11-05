import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { usePlatform } from '@/features/auth/usePlatform'

export function AuthLayout() {
  const platform = usePlatform()
  const name = platform?.platform_name ?? 'Softio Comptabilité'

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1fr] xl:grid-cols-[54fr_46fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-linear-to-br from-admin to-brand-500 px-10 py-10 text-white lg:flex xl:px-[9%] 2xl:py-16">
        <div className="relative z-10 my-auto py-8">
          <div className="mb-10 w-fit rounded-card bg-white px-5 py-3 shadow-overlay xl:mb-12 xl:px-6 xl:py-3.5">
            <Logo className="h-14 xl:h-18 2xl:h-20" />
          </div>
          <div className="max-w-md 2xl:max-w-lg">
            <p className="mb-4 text-3xl leading-tight font-bold xl:mb-5 xl:text-4xl 2xl:text-5xl">
              La comptabilité de votre entreprise, en toute clarté.
            </p>
            <p className="text-sm leading-relaxed text-white/80 xl:text-base [@media(max-height:600px)]:hidden">
              Écritures, factures, paiements et rapports réunis dans un seul espace de travail.
            </p>
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/70">
          © {new Date().getFullYear()} {name}
        </p>
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-48 size-96 rounded-full border border-white/15 shadow-[0_0_0_48px_rgb(255_255_255/0.035),0_0_0_98px_rgb(255_255_255/0.025)] 2xl:size-115"
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