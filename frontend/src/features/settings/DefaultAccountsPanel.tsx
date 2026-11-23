import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { ErrorState, InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { accountsApi } from '@/features/accounts/api'
import { useAccountingDefaults, useUpdateAccountingDefaults } from '@/features/settings/api'
import { errorMessage } from '@/lib/form-errors'
import type { Account, AccountingDefaults, AccountType } from '@/types/api'

interface FieldDef {
  name: keyof AccountingDefaults
  label: string
  hint: string
  type: AccountType
}

const groups: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Comptes de tiers',
    fields: [
      {
        name: 'receivable_account_id',
        label: 'Compte clients',
        hint: 'Créances sur les factures de vente.',
        type: 'asset',
      },
      {
        name: 'payable_account_id',
        label: 'Compte fournisseurs',
        hint: 'Dettes sur les factures d’achat.',
        type: 'liability',
      },
    ],
  },
  {
    title: 'TVA',
    fields: [
      {
        name: 'vat_collected_account_id',
        label: 'TVA collectée',
        hint: 'TVA sur les ventes.',
        type: 'liability',
      },
      {
        name: 'vat_deductible_account_id',
        label: 'TVA déductible',
        hint: 'TVA récupérable sur les achats.',
        type: 'asset',
      },
    ],
  },
  {
    title: 'Trésorerie',
    fields: [
      {
        name: 'bank_account_id',
        label: 'Compte de banque',
        hint: 'Compte utilisé pour les règlements bancaires.',
        type: 'asset',
      },
      {
        name: 'cash_account_id',
        label: 'Compte de caisse',
        hint: 'Compte utilisé pour les règlements en espèces.',
        type: 'asset',
      },
    ],
  },
]

/** Onglet « Comptes par défaut » : comptes utilisés automatiquement par la facturation. */
export function DefaultAccountsPanel() {
  const defaults = useAccountingDefaults()
  const accounts = accountsApi.useOptions({ is_active: 1 })

  if (defaults.isLoading || accounts.isLoading) return <LoadingSpinner />
  if (defaults.isError || !defaults.data) {
    return (
      <ErrorState message={errorMessage(defaults.error)} onRetry={() => void defaults.refetch()} />
    )
  }
  if (accounts.isError || !accounts.data) {
    return (
      <ErrorState message={errorMessage(accounts.error)} onRetry={() => void accounts.refetch()} />
    )
  }

  return <DefaultAccountsForm values={defaults.data} accounts={accounts.data} />
}

function DefaultAccountsForm({
  values,
  accounts,
}: {
  values: AccountingDefaults
  accounts: Account[]
}) {
  const { can } = useAuth()
  const toast = useToast()
  const update = useUpdateAccountingDefaults()
  const canEdit = can('accounts.update')
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      groups.flatMap((g) => g.fields).map((f) => [f.name, String(values[f.name] ?? '')]),
    ),
  })

  const onSubmit = handleSubmit(async (form) => {
    setFormError(null)
    const input = Object.fromEntries(
      groups
        .flatMap((g) => g.fields)
        .map((f) => [f.name, form[f.name] ? Number(form[f.name]) : null]),
    ) as unknown as AccountingDefaults

    try {
      await update.mutateAsync(input)
      reset(form)
      toast.success('Comptes par défaut enregistrés.')
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })

  return (
    <Card
      title="Comptes par défaut"
      actions={
        canEdit && (
          <Button
            type="submit"
            form="defaults-form"
            size="sm"
            loading={formState.isSubmitting}
            disabled={!formState.isDirty}
          >
            Enregistrer
          </Button>
        )
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        Ces comptes sont utilisés automatiquement lors de la validation des factures, avoirs,
        dépenses et paiements. Laissez « Automatique » pour utiliser le premier compte actif de la
        catégorie.
      </p>
      <form id="defaults-form" onSubmit={onSubmit} noValidate className="space-y-6">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        {groups.map((group) => (
          <fieldset key={group.title} disabled={!canEdit} className="space-y-3">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {group.title}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <FormField key={field.name} label={field.label} hint={field.hint}>
                  {(c) => (
                    <Select {...c} {...register(field.name)}>
                      <option value="">Automatique</option>
                      {accounts
                        .filter((a) => !a.is_group && a.type === field.type)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                    </Select>
                  )}
                </FormField>
              ))}
            </div>
          </fieldset>
        ))}
      </form>
    </Card>
  )
}
