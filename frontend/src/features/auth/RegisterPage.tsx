import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { InlineAlert } from '@/components/feedback/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { authApi, type RegisterResult } from '@/features/auth/api'
import { DEFAULT_PASSWORD_MIN, passwordHint, passwordSchema } from '@/features/auth/passwordSchema'
import { usePlatform } from '@/features/auth/usePlatform'
import { applyApiErrors } from '@/lib/form-errors'

function buildSchema(minLength: number) {
  return z
    .object({
      company_name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire."),
      name: z.string().trim().min(1, 'Votre nom est obligatoire.'),
      email: z.string().min(1, "L'e-mail est obligatoire.").email("Format d'e-mail invalide."),
      password: passwordSchema(minLength),
      password_confirmation: z.string().min(1, 'Confirmez le mot de passe.'),
      accept_terms: z
        .boolean()
        .refine(Boolean, "Vous devez accepter les conditions d'utilisation."),
    })
    .refine((values) => values.password === values.password_confirmation, {
      path: ['password_confirmation'],
      message: 'Les deux mots de passe ne correspondent pas.',
    })
}
type RegisterValues = z.infer<ReturnType<typeof buildSchema>>

export function RegisterPage() {
  const { user } = useAuth()
  const platform = usePlatform()
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const minLength = platform?.password_min_length ?? DEFAULT_PASSWORD_MIN
  const termsUrl = platform?.terms_url ?? null
  const schema = useMemo(() => buildSchema(minLength), [minLength])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: '',
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      accept_terms: false,
    },
  })

  if (user) return <Navigate to="/" replace />

  if (platform && platform.registration_enabled === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">Inscriptions fermées</h1>
        <p className="text-sm text-ink-muted">
          Les inscriptions ne sont pas ouvertes pour le moment. Contactez l&apos;administrateur de
          la plateforme.
        </p>
        <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  if (result) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">
          {result.verification_required ? 'Vérifiez votre boîte e-mail' : 'Compte créé'}
        </h1>
        <InlineAlert tone="info">{result.message}</InlineAlert>
        {result.verification_required && (
          <p className="text-sm text-ink-muted">
            Le lien est valable 48 heures. Pensez à regarder dans vos courriers indésirables.
          </p>
        )}
        <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
          Aller à la connexion
        </Link>
      </div>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      setResult(await authApi.register(values))
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Créer un compte</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Créez l&apos;espace de votre entreprise : vous en serez l&apos;administrateur.
        </p>
      </div>
      {formError && <InlineAlert>{formError}</InlineAlert>}
      <FormField label="Nom de l'entreprise" error={errors.company_name?.message} required>
        {(control) => (
          <Input autoComplete="organization" autoFocus {...control} {...register('company_name')} />
        )}
      </FormField>
      <FormField label="Votre nom" error={errors.name?.message} required>
        {(control) => <Input autoComplete="name" {...control} {...register('name')} />}
      </FormField>
      <FormField label="Adresse e-mail" error={errors.email?.message} required>
        {(control) => (
          <Input type="email" autoComplete="email" {...control} {...register('email')} />
        )}
      </FormField>
      <FormField
        label="Mot de passe"
        error={errors.password?.message}
        hint={passwordHint(minLength)}
        required
      >
        {(control) => (
          <Input
            type="password"
            autoComplete="new-password"
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
      <div>
        <Checkbox
          {...register('accept_terms')}
          label={
            termsUrl ? (
              <>
                J&apos;accepte les{' '}
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline"
                >
                  conditions d&apos;utilisation
                </a>
              </>
            ) : (
              "J'accepte les conditions d'utilisation"
            )
          }
        />
        {errors.accept_terms?.message && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {errors.accept_terms.message}
          </p>
        )}
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Créer mon compte
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
