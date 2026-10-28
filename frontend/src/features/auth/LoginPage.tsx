import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { InlineAlert } from '@/components/feedback/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { authApi } from '@/features/auth/api'
import { usePlatform } from '@/features/auth/usePlatform'
import { ApiError } from '@/lib/api-client'
import { applyApiErrors } from '@/lib/form-errors'

const schema = z.object({
  email: z.string().min(1, "L'e-mail est obligatoire.").email("Format d'e-mail invalide."),
  password: z.string().min(1, 'Le mot de passe est obligatoire.'),
})
type LoginValues = z.infer<typeof schema>

const VERIFIED_NOTICES: Record<string, { tone: 'info' | 'danger'; text: string }> = {
  '1': { tone: 'info', text: 'Adresse e-mail confirmée. Vous pouvez vous connecter.' },
  expired: {
    tone: 'danger',
    text: 'Ce lien de confirmation a expiré. Connectez-vous pour en recevoir un nouveau.',
  },
  invalid: { tone: 'danger', text: "Ce lien de confirmation n'est pas valide." },
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const platform = usePlatform()
  const [formError, setFormError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const {
    getValues,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (user) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from

  const verifiedNotice = VERIFIED_NOTICES[searchParams.get('verified') ?? '']
  const resetDone = searchParams.get('reset') === '1'

  const resend = async () => {
    setResendMessage(null)
    try {
      setResendMessage((await authApi.resendVerification(getValues('email'))).message)
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : 'Une erreur est survenue.')
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setNeedsVerification(false)
    setResendMessage(null)
    try {
      const signedIn = await login(values.email, values.password)
      navigate(
        from && from !== '/login' ? from : signedIn.role.scope === 'platform' ? '/admin' : '/',
        {
          replace: true,
        },
      )
    } catch (error) {
      setNeedsVerification(error instanceof ApiError && error.code === 'email_not_verified')
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Connexion</h1>
        <p className="mt-1 text-sm text-ink-muted">Accédez à votre espace de travail.</p>
      </div>
      {verifiedNotice && (
        <InlineAlert tone={verifiedNotice.tone}>{verifiedNotice.text}</InlineAlert>
      )}
      {resetDone && (
        <InlineAlert tone="info">
          Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.
        </InlineAlert>
      )}
      {formError && <InlineAlert>{formError}</InlineAlert>}
      {needsVerification && (
        <div className="space-y-2">
          <Button type="button" variant="secondary" size="sm" onClick={resend}>
            Renvoyer l&apos;e-mail de confirmation
          </Button>
          {resendMessage && <InlineAlert tone="info">{resendMessage}</InlineAlert>}
        </div>
      )}
      <FormField label="Adresse e-mail" error={errors.email?.message} required>
        {(control) => (
          <Input
            type="email"
            autoComplete="username"
            autoFocus
            {...control}
            {...register('email')}
          />
        )}
      </FormField>
      <FormField label="Mot de passe" error={errors.password?.message} required>
        {(control) => (
          <Input
            type="password"
            autoComplete="current-password"
            {...control}
            {...register('password')}
          />
        )}
      </FormField>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Se connecter
      </Button>
            <div className="text-center text-sm">
        <Link to="/forgot-password" className="text-brand-600 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      {platform?.registration_enabled !== false && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-center text-sm text-ink-muted">Pas encore de compte ?</p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/register')}
          >
            S&apos;inscrire
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-brand-600 hover:underline">
          Mot de passe oublié ?
        </Link>
        {platform?.registration_enabled && (
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Créer un compte
          </Link>
        )}
      </div>
    </form>
  )
}
