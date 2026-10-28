import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

function Screen({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-brand-600">{code}</p>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="max-w-md text-sm text-ink-muted">{text}</p>
      <Link to="/">
        <Button variant="secondary">Retour à l'accueil</Button>
      </Link>
    </main>
  )
}

export function ForbiddenPage() {
  return (
    <Screen
      code="403"
      title="Accès refusé"
      text="Vous n'avez pas la permission d'accéder à cette page. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur."
    />
  )
}

export function NotFoundPage() {
  return (
    <Screen
      code="404"
      title="Page introuvable"
      text="La page demandée n'existe pas ou a été déplacée."
    />
  )
}
