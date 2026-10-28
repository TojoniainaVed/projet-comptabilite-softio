import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { InlineAlert } from '@/components/feedback/States'
import { authApi } from '@/features/auth/api'
import { DEFAULT_PASSWORD_MIN, passwordHint, passwordSchema } from '@/features/auth/passwordSchema'
import { usePlatform } from '@/features/auth/usePlatform'
import { ApiError } from '@/lib/api-client'
import { applyApiErrors } from '@/lib/form-errors'

function buildSchema(minLength: number) {
  return z
    .object({
      password: passwordSchema(minLength),
      password_confirmation: z.string().min(1, 'Confirmez le mot de passe.'),
    })
    .refine((values) => values.password === values.password_confirmation, {
      path: ['password_confirmation'],
      message: 'Les deux mots de passe ne correspondent pas.',
    })
}
type Values = z.infer<ReturnType<typeof buildSchema>>

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const platform = usePlatform()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const minLength = platform?.password_min_length ?? DEFAULT_PASSWORD_MIN
  const schema = useMemo(() => buildSchema(minLength), [minLength])
  const [formError, setFormError] = useState<string | null>(null)
  const [linkInvalid, setLinkInvalid] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', password_confirmation: '' },
  })

  if (!token || !email || linkInvalid) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">Lien invalide ou expiré</h1>
        <p className="text-sm text-ink-muted">
          Ce lien de réinitialisation ne peut plus être utilisé. Demandez-en un nouveau.
        </p>
        <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.resetPassword({ token, email, ...values })
      navigate('/login?reset=1', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_reset_token') {
        setLinkInvalid(true)
        return
      }
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Compte : <span className="font-medium text-ink">{email}</span>
        </p>
      </div>
      {formError && <InlineAlert>{formError}</InlineAlert>}
      <FormField
        label="Nouveau mot de passe"
        error={errors.password?.message}
        hint={passwordHint(minLength)}
        required
      >
        {(control) => (
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            {...control}
            {...register('password')}
          />
        )}
      </FormField>
      <FormField
        label="Confirmation du mot de passe"
        error={errors.password_confirmation?.message}
        required
      >
        {(control) => (
          <Input
            type="password"
            autoComplete="new-password"
            {...control}
            {...register('password_confirmation')}
          />
        )}
      </FormField>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Enregistrer le mot de passe
      </Button>
    </form>
  )
}
