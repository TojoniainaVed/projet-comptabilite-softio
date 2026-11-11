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
  code: z.string().trim().min(1, 'Le code est obligatoire.').max(20),
  name: z.string().trim().min(1, "L'intitulé est obligatoire.").max(255),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  category: z.string(),
  parent_id: z.string(),
  is_group: z.boolean(),
  is_active: z.boolean(),
})

type Values = z.infer<typeof schema>

const empty: Values = {
  code: '',
  name: '',
  type: 'asset',
  category: '',
  parent_id: '',
  is_group: false,
  is_active: true,
}

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
  const accountsQuery = accountsApi.useList({ per_page: 100 })

  const [formError, setFormError] = useState<string | null>(null)

  const editing = account !== null && account !== 'new' ? account : null
  const availableAccounts = accountsQuery.data?.data ?? []

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type,
          category: editing.category ?? '',
          parent_id: editing.parent_id ? String(editing.parent_id) : '',
          is_group: editing.is_group,
          is_active: editing.is_active,
        }
      : empty,
  })

  const isGroup = watch('is_group')
  const selectedType = watch('type')

  // Exclure le compte lui-même et ses descendants des choix de parents.
  const descendantIds = new Set<number>()

  if (editing) {
    const collectDescendants = (parentId: number): void => {
      for (const item of availableAccounts) {
        if (item.parent_id === parentId && !descendantIds.has(item.id)) {
          descendantIds.add(item.id)
          collectDescendants(item.id)
        }
      }
    }

    collectDescendants(editing.id)
  }

  const parentOptions = availableAccounts.filter((item) => {
    return (
      item.is_group &&
      item.type === selectedType &&
      item.id !== editing?.id &&
      !descendantIds.has(item.id)
    )
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const input = {
      code: values.code,
      name: values.name,
      type: values.type,
      category: values.is_group || !values.category ? null : values.category,
      parent_id: values.parent_id ? Number(values.parent_id) : null,
      is_group: values.is_group,
      is_active: values.is_active,
    }

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          input,
        })
      } else {
        await create.mutateAsync(input)
      }

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
          {(props) => <Input {...props} {...register('code')} />}
        </FormField>

        <FormField label="Intitulé" error={errors.name?.message} required>
          {(props) => <Input {...props} {...register('name')} />}
        </FormField>

        <FormField label="Type comptable" error={errors.type?.message} required>
          {(props) => (
            <Select
              {...props}
              {...register('type', {
                onChange: () => setValue('parent_id', ''),
              })}
            >
              {optionsOf(accountTypeLabels).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Compte parent"
          hint="Facultatif. Sélectionnez un compte de regroupement pour rattacher ce compte à l'arborescence."
          error={errors.parent_id?.message}
        >
          {(props) => (
            <Select {...props} {...register('parent_id')}>
              <option value="">Aucun compte parent (racine)</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.code} — {parent.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <Checkbox
          label="Compte de regroupement"
          {...register('is_group', {
            onChange: (event) => {
              if (event.target.checked) {
                setValue('category', '')
              }
            },
          })}
        />

        <FormField
          label="Rôle automatique"
          hint={
            isGroup
              ? 'Un compte de regroupement ne reçoit pas de rôle automatique.'
              : 'Utilisé par les factures, paiements et dépenses pour trouver le bon compte.'
          }
          error={errors.category?.message}
        >
          {(props) => (
            <Select {...props} {...register('category')} disabled={isGroup}>
              <option value="">Aucun</option>
              {optionsOf(accountCategoryLabels).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
