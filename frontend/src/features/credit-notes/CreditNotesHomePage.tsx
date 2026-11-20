import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Clock3, FileText, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'

export function CreditNotesHomePage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="Gestion des avoirs"
        description="Gérez les avoirs liés à vos opérations de vente et d'achat."
      />

      {/* Espaces de gestion */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/credit-notes/customers')}
          className="group block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText className="size-6" />
              </div>

              <ArrowUpRight className="size-5 text-ink-muted transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </div>

            <div className="mt-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Espace de vente
              </p>
              <h2 className="text-lg font-semibold text-ink">Avoirs clients</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Gérer les avoirs émis aux clients et les corrections des factures de vente.
              </p>
            </div>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate('/credit-notes/suppliers')}
          className="group block w-full rounded-xl text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <ShoppingCart className="size-6" />
              </div>

              <ArrowUpRight className="size-5 text-ink-muted transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </div>

            <div className="mt-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
                Espace d'achat
              </p>
              <h2 className="text-lg font-semibold text-ink">Avoirs fournisseurs</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Gérer les avoirs reçus des fournisseurs et les corrections des factures d'achat.
              </p>
            </div>
          </Card>
        </button>
      </div>

      {/* Indicateurs généraux */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink">Vue d'ensemble</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Suivi global des avoirs clients et fournisseurs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total des avoirs"
          value="—"
          hint="En attente de connexion aux données"
          icon={<FileText className="size-5" />}
        />

        <StatCard
          label="En attente"
          value="—"
          hint="En attente de connexion aux données"
          icon={<Clock3 className="size-5" />}
        />

        <StatCard
          label="Validés"
          value="—"
          hint="En attente de connexion aux données"
          icon={<CheckCircle2 className="size-5" />}
        />
      </div>
    </div>
  )
}
