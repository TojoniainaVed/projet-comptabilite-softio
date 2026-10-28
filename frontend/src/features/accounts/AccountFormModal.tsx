import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { applyApiErrors } from '@/lib/form-errors'
import { accountCategoryLabels, accountTypeLabels, optionsOf } from '@/lib/labels'
import { accountsApi } from '@/features/accounts/api'
import type { Account } from '@/types/api'

const schema = z.object({
  code: z.string().trim().min(1, 'Le code est obligatoire.').max(20, '20 caractères maximum.'),
  name: z.string().trim().min(1, "L'intitulé est obligatoire.").max(255),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  category: z.string(),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

const empty: Values = { code: '', name: '', type: 'asset', category: '', is_active: true }

export function AccountFormModal(props: ComponentProps<typeof AccountFormModalBody>) {
  return props.account === null ? null : <AccountFormModalBody {...props} />
}

function AccountFormModalBody({
  account,
  onClose,
}: {
  account: Account | 'new' | null
  onClose: () => void
}) {
  const toast = useToast()
  const create = accountsApi.useCreate()
  const update = accountsApi.useUpdate()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = account !== null && account !== 'new' ? account : null

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type,
          category: editing.category ?? '',
          is_active: editing.is_active,
        }
      : empty,
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = { ...values, category: values.category || null }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success(editing ? 'Compte mis à jour.' : 'Compte créé.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={account !== null}
      onClose={onClose}
      title={editing ? 'Modifier le compte' : 'Nouveau compte'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="account-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Code" error={errors.code?.message} required>
          {(c) => <Input {...c} {...register('code')} />}
        </FormField>
        <FormField label="Intitulé" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Type" error={errors.type?.message} required>
          {(c) => (
            <Select {...c} {...register('type')}>
              {optionsOf(accountTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Rôle automatique"
          hint="Utilisé par les factures, paiements et dépenses pour trouver le bon compte."
          error={errors.category?.message}
        >
          {(c) => (
            <Select {...c} {...register('category')}>
              <option value="">Aucun</option>
              {optionsOf(accountCategoryLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <Checkbox label="Compte actif" {...register('is_active')} />
      </form>
    </Modal>
  )
}
