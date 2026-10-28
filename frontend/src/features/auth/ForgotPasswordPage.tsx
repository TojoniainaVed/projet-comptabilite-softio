import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { InlineAlert } from '@/components/feedback/States'
import { authApi } from '@/features/auth/api'
import { applyApiErrors } from '@/lib/form-errors'

const schema = z.object({
  email: z.string().min(1, "L'e-mail est obligatoire.").email("Format d'e-mail invalide."),
})
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      setSent((await authApi.forgotPassword(email)).message)
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Saisissez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot
          de passe.
        </p>
      </div>
      {sent ? (
        <InlineAlert tone="info">{sent}</InlineAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <FormField label="Adresse e-mail" error={errors.email?.message} required>
            {(control) => (
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                {...control}
                {...register('email')}
              />
            )}
          </FormField>
          <Button type="submit" loading={isSubmitting} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
      <Link to="/login" className="block text-sm font-medium text-brand-600 hover:underline">
        Retour à la connexion
      </Link>
    </div>
  )
}
