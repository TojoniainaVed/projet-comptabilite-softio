import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InlineAlert } from '@/components/feedback/States'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Arrivée depuis Softio : l'URL contient un code temporaire (valable une minute, une seule fois).
 * Le backend l'échange auprès de Softio puis ouvre la session.
 */
export function SsoPage() {
  const { loginWithSoftio } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // Le code ne sert qu'une fois : on évite un second envoi (double rendu en développement)
  const sent = useRef(false)

  const code = searchParams.get('code')

  useEffect(() => {
    if (sent.current || !code) return
    sent.current = true

    // Le code ne doit pas rester dans l'historique du navigateur
    window.history.replaceState(null, '', '/sso')

    loginWithSoftio(code)
      .then((user) => navigate(user.role.scope === 'platform' ? '/admin' : '/', { replace: true }))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Connexion impossible pour le moment.'),
      )
  }, [code, loginWithSoftio, navigate])

  const message = code ? error : 'Lien de connexion incomplet. Rouvrez le module depuis Softio.'

  if (message) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">Connexion depuis Softio</h1>
        <InlineAlert>{message}</InlineAlert>
        <p className="text-sm text-ink-muted">
          Retournez dans Softio et cliquez à nouveau sur « Ouvrir le module ».
        </p>
        <Link to="/login" className="text-sm text-brand-600 hover:underline">
          Se connecter avec un compte comptable
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-center" role="status">
      <div
        aria-hidden="true"
        className="mx-auto size-8 animate-spin rounded-full border-2 border-line border-t-brand-500"
      />
      <h1 className="text-xl font-semibold text-ink">Connexion depuis Softio…</h1>
      <p className="text-sm text-ink-muted">Vérification de votre abonnement en cours.</p>
    </div>
  )
}
