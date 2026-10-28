import { useState, type ComponentProps } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { InlineAlert } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { useListParams } from '@/hooks/useListParams'
import { ActiveBadge } from '@/components/ui/StatusBadges'
import { applyApiErrors, errorMessage } from '@/lib/form-errors'
import { formatDateTime } from '@/lib/utils'
import { companiesApi, useRoles, useSetUserStatus, usersApi } from '@/features/administration/api'
import type { User } from '@/types/api'

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(255),
  email: z.string().trim().min(1, "L'e-mail est obligatoire.").email("Format d'e-mail invalide."),
  password: z.string(),
  role_id: z.string().min(1, 'Choisissez un rôle.'),
  company_id: z.string(),
})
type Values = z.infer<typeof schema>
const empty: Values = { name: '', email: '', password: '', role_id: '', company_id: '' }

export function UsersPage() {
  const { can, user: me } = useAuth()
  const toast = useToast()
  const list = useListParams()
  const query = usersApi.useList({ ...list.params, per_page: 25 })
  const roles = useRoles()
  const setStatus = useSetUserStatus()
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [toggling, setToggling] = useState<User | null>(null)

  const toggle = async () => {
    if (!toggling) return
    try {
      await setStatus.mutateAsync({ id: toggling.id, is_active: !toggling.is_active })
      toast.success(toggling.is_active ? 'Utilisateur désactivé.' : 'Utilisateur activé.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setToggling(null)
    }
  }

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nom', cell: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'email', header: 'E-mail', cell: (u) => u.email },
    { key: 'role', header: 'Rôle', cell: (u) => u.role.name },
    { key: 'company', header: 'Entreprise', cell: (u) => u.company?.name ?? '—' },
    { key: 'last', header: 'Dernière connexion', cell: (u) => formatDateTime(u.last_login_at) },
    { key: 'status', header: 'Statut', cell: (u) => <ActiveBadge active={u.is_active} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (u) => (
        <div className="flex justify-end gap-1">
          {can('users.update') && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil className="size-4" aria-hidden="true" />}
              onClick={() => setEditing(u)}
              aria-label={`Modifier ${u.name}`}
            >
              Modifier
            </Button>
          )}
          {can('users.administer') && u.id !== me?.id && (
            <Button
              variant="ghost"
              size="sm"
              icon={
                u.is_active ? (
                  <UserX className="size-4" aria-hidden="true" />
                ) : (
                  <UserCheck className="size-4" aria-hidden="true" />
                )
              }
              onClick={() => setToggling(u)}
              aria-label={`${u.is_active ? 'Désactiver' : 'Activer'} ${u.name}`}
            >
              {u.is_active ? 'Désactiver' : 'Activer'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        actions={
          can('users.create') && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              Nouvel utilisateur
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput
            value={list.filters.search ?? ''}
            onChange={(v) => list.setFilter('search', v)}
            placeholder="Nom ou e-mail"
          />
          <Select
            aria-label="Filtrer par rôle"
            className="sm:w-56"
            value={list.filters.role_id ?? ''}
            onChange={(e) => list.setFilter('role_id', e.target.value)}
          >
            <option value="">Tous les rôles</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par statut"
            className="sm:w-44"
            value={list.filters.is_active ?? ''}
            onChange={(e) => list.setFilter('is_active', e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="1">Actifs</option>
            <option value="0">Inactifs</option>
          </Select>
        </div>
        <DataTable
          caption="Liste des utilisateurs"
          columns={columns}
          rows={query.data?.data}
          rowKey={(u) => u.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun utilisateur"
        />
        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
      <UserModal user={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "Désactiver l'utilisateur" : "Activer l'utilisateur"}
        message={
          toggling?.is_active
            ? `${toggling.name} ne pourra plus se connecter et ses sessions ouvertes seront fermées.`
            : `${toggling?.name} pourra de nouveau se connecter.`
        }
        confirmLabel={toggling?.is_active ? 'Désactiver' : 'Activer'}
        danger={toggling?.is_active}
        loading={setStatus.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() => void toggle()}
      />
    </>
  )
}

function UserModal(props: ComponentProps<typeof UserModalBody>) {
  return props.user === null ? null : <UserModalBody {...props} />
}

function UserModalBody({ user, onClose }: { user: User | 'new' | null; onClose: () => void }) {
  const { isPlatformAdmin, user: me } = useAuth()
  const toast = useToast()
  const create = usersApi.useCreate()
  const update = usersApi.useUpdate()
  const roles = useRoles()
  const companies = companiesApi.useOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = user !== null && user !== 'new' ? user : null

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: editing.name,
          email: editing.email,
          password: '',
          role_id: String(editing.role.id),
          company_id: editing.company ? String(editing.company.id) : '',
        }
      : { ...empty, company_id: isPlatformAdmin ? '' : String(me?.company?.id ?? '') },
  })
  const roleId = useWatch({ control, name: 'role_id' })
  const selectedRole = roles.data?.find((r) => String(r.id) === roleId)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    if (!editing && values.password === '') {
      setError('password', { message: 'Le mot de passe est obligatoire.' })
      return
    }
    const input = {
      name: values.name,
      email: values.email,
      role_id: Number(values.role_id),
      company_id:
        selectedRole?.scope === 'platform'
          ? null
          : values.company_id
            ? Number(values.company_id)
            : null,
      ...(values.password ? { password: values.password } : {}),
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await create.mutateAsync(input)
      toast.success(editing ? 'Utilisateur mis à jour.' : 'Utilisateur créé.')
      onClose()
    } catch (error) {
      setFormError(applyApiErrors(error, setError))
    }
  })

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={editing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="user-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <FormField label="Nom" error={errors.name?.message} required>
          {(c) => <Input {...c} {...register('name')} />}
        </FormField>
        <FormField label="Adresse e-mail" error={errors.email?.message} required>
          {(c) => <Input type="email" autoComplete="off" {...c} {...register('email')} />}
        </FormField>
        <FormField
          label={editing ? 'Nouveau mot de passe' : 'Mot de passe'}
          error={errors.password?.message}
          required={!editing}
          hint={
            editing
              ? 'Laisser vide pour conserver le mot de passe actuel.'
              : 'Selon la politique de la plateforme : longueur minimale, majuscule, minuscule et chiffre.'
          }
        >
          {(c) => (
            <Input type="password" autoComplete="new-password" {...c} {...register('password')} />
          )}
        </FormField>
        <FormField label="Rôle" error={errors.role_id?.message} required>
          {(c) => (
            <Select {...c} {...register('role_id')}>
              <option value="">Sélectionner…</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {isPlatformAdmin && selectedRole?.scope !== 'platform' && (
          <FormField label="Entreprise" error={errors.company_id?.message} required>
            {(c) => (
              <Select {...c} {...register('company_id')}>
                <option value="">Sélectionner…</option>
                {companies.data?.map((co) => (
                  <option key={co.id} value={co.id}>
                    {co.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
      </form>
    </Modal>
  )
}
