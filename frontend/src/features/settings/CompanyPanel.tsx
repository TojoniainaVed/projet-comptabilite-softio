import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCompanySettings, useUpdateCompany } from '@/features/settings/api'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import type { Company } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(255),
  legal_name: z.string().trim().max(255),
  tax_id: z.string().trim().max(50, '50 caractères maximum.'),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), {
      message: 'Adresse e-mail invalide.',
    }),
  phone: z.string().trim().max(40, '40 caractères maximum.'),
  address: z.string().trim().max(1000),
})
type Values = z.infer<typeof schema>

/** Onglet « Général » : informations de la société reprises sur les documents imprimés. */
export function CompanyPanel() {
  const query = useCompanySettings()

  if (query.isLoading) return <LoadingSpinner />
  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
  }
  return <CompanyForm company={query.data} />
}

function CompanyForm({ company }: { company: Company }) {
  const { can } = useAuth()
  const toast = useToast()
  const update = useUpdateCompany()
  const canEdit = can('companies.update')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company.name,
      legal_name: company.legal_name ?? '',
      tax_id: company.tax_id ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await update.mutateAsync({
        name: values.name,
        legal_name: values.legal_name || null,
        tax_id: values.tax_id || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
      })
      toast.success('Informations de la société enregistrées.')
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Card
      title="Informations de la société"
      actions={
        canEdit && (
          <Button
            type="submit"
            form="company-form"
            size="sm"
            loading={isSubmitting}
            disabled={!isDirty}
          >
            Enregistrer
          </Button>
        )
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        Ces informations apparaissent sur vos factures, avoirs et rapports imprimés.
      </p>
      <form id="company-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nom commercial" error={errors.name?.message} required>
            {(c) => <Input {...c} {...register('name')} />}
          </FormField>
          <FormField label="Raison sociale" error={errors.legal_name?.message}>
            {(c) => <Input {...c} {...register('legal_name')} />}
          </FormField>
          <FormField
            label="NIF / STAT"
            hint="Numéro d'identification fiscale ou statistique."
            error={errors.tax_id?.message}
          >
            {(c) => <Input {...c} {...register('tax_id')} />}
          </FormField>
          <FormField label="Devise" hint="La devise est fixée à la création de la société.">
            {(c) => <Input {...c} value={company.currency} readOnly disabled />}
          </FormField>
          <FormField label="E-mail" error={errors.email?.message}>
            {(c) => <Input {...c} type="email" {...register('email')} />}
          </FormField>
          <FormField label="Téléphone" error={errors.phone?.message}>
            {(c) => <Input {...c} {...register('phone')} />}
          </FormField>
          <FormField label="Adresse" error={errors.address?.message} className="sm:col-span-2">
            {(c) => <Input {...c} {...register('address')} />}
          </FormField>
        </fieldset>
        {!canEdit && (
          <p className="text-xs text-ink-muted">
            Seul un administrateur de l'entreprise peut modifier ces informations.
          </p>
        )}
      </form>
    </Card>
  )
}
