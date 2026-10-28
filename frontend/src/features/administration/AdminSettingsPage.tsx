import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { useAdminSettings, useUpdateAdminSettings } from '@/features/administration/api'

const schema = z.object({
  platform_name: z.string().trim().min(2, '2 caractères minimum.').max(80),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale attendue (#2563eb).'),
  default_locale: z.enum(['fr', 'en']),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Code ISO à 3 lettres.'),
  password_min_length: z.coerce.number().int().min(8, 'Entre 8 et 64.').max(64, 'Entre 8 et 64.'),
  expenses: z.boolean(),
})
type Input = z.input<typeof schema>
type Values = z.output<typeof schema>

export function AdminSettingsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const query = useAdminSettings()
  const update = useUpdateAdminSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const editable = can('settings.update')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Input, unknown, Values>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const s = query.data
    if (!s) return
    reset({
      platform_name: s.platform_name,
      brand_color: s.brand_color,
      default_locale: s.default_locale,
      default_currency: s.default_currency,
      password_min_length: s.password_min_length,
      expenses: s.features.expenses,
    })
  }, [query.data, reset])

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await update.mutateAsync({
        platform_name: values.platform_name,
        brand_color: values.brand_color,
        default_locale: values.default_locale,
        default_currency: values.default_currency,
        password_min_length: values.password_min_length,
        features: { expenses: values.expenses },
      })
      toast.success('Paramètres enregistrés.')
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <>
      <PageHeader
        title="Paramètres de la plateforme"
        description="Chaque modification est tracée dans le journal d'audit."
      />
      <form onSubmit={onSubmit} noValidate className="max-w-2xl space-y-6">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <Card title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom de la plateforme" error={errors.platform_name?.message} required>
              {(c) => <Input disabled={!editable} {...c} {...register('platform_name')} />}
            </FormField>
            <FormField label="Couleur de marque" error={errors.brand_color?.message} required>
              {(c) => <Input disabled={!editable} {...c} {...register('brand_color')} />}
            </FormField>
          </div>
        </Card>
        <Card title="Valeurs par défaut">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Langue par défaut" error={errors.default_locale?.message}>
              {(c) => (
                <Select disabled={!editable} {...c} {...register('default_locale')}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              )}
            </FormField>
            <FormField label="Devise par défaut" error={errors.default_currency?.message}>
              {(c) => (
                <Input
                  maxLength={3}
                  disabled={!editable}
                  {...c}
                  {...register('default_currency')}
                />
              )}
            </FormField>
          </div>
        </Card>
        <Card title="Sécurité et modules">
          <div className="space-y-4">
            <FormField
              label="Longueur minimale des mots de passe"
              error={errors.password_min_length?.message}
              hint="S'applique aux mots de passe créés ou modifiés après le changement."
            >
              {(c) => (
                <Input
                  type="number"
                  min={8}
                  max={64}
                  className="sm:w-32"
                  disabled={!editable}
                  {...c}
                  {...register('password_min_length')}
                />
              )}
            </FormField>
            <Checkbox
              label="Module Dépenses activé"
              disabled={!editable}
              {...register('expenses')}
            />
          </div>
        </Card>
        {editable && (
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Enregistrer
            </Button>
          </div>
        )}
      </form>
    </>
  )
}
