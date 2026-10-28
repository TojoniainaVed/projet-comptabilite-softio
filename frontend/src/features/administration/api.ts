import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { createResource } from '@/lib/resource'
import type {
  AdminDashboard,
  AuditLog,
  Company,
  PermissionGroup,
  PlatformSettings,
  Role,
  SessionInfo,
  User,
} from '@/types/api'

export interface UserInput {
  name: string
  email: string
  password?: string
  role_id: number
  company_id: number | null
}

export interface CompanyInput {
  name: string
  legal_name: string | null
  tax_id: string | null
  email: string | null
  phone: string | null
  address: string | null
  currency: string
  locale: string
  status: 'active' | 'suspended'
}

export const usersApi = createResource<User, UserInput>('admin-users', '/admin/users')
export const companiesApi = createResource<Company, CompanyInput>(
  'admin-companies',
  '/admin/companies',
)
export const auditLogsApi = createResource<AuditLog>('admin-audit-logs', '/admin/audit-logs')

export const useAdminDashboard = () =>
  useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: ({ signal }) =>
      api.get<{ data: AdminDashboard }>('/admin/dashboard', undefined, signal),
    select: (r) => r.data,
  })

export const useRoles = () =>
  useQuery({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => api.get<{ data: Role[] }>('/admin/roles', undefined, signal),
    select: (r) => r.data,
  })

export const usePermissionCatalog = () =>
  useQuery({
    queryKey: ['admin-permissions'],
    queryFn: ({ signal }) =>
      api.get<{ data: PermissionGroup[] }>('/admin/permissions', undefined, signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
  })

export function useUpdateRolePermissions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      api.put<{ data: Role }>(`/admin/roles/${id}/permissions`, { permissions }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-roles'] }),
  })
}

export function useSetUserStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch<{ data: User }>(`/admin/users/${id}/status`, { is_active }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: usersApi.keys.all }),
        client.invalidateQueries({ queryKey: ['admin-dashboard'] }),
        client.invalidateQueries({ queryKey: ['admin-sessions'] }),
      ]),
  })
}

export const useAdminSettings = () =>
  useQuery({
    queryKey: ['admin-settings'],
    queryFn: ({ signal }) =>
      api.get<{ data: PlatformSettings }>('/admin/settings', undefined, signal),
    select: (r) => r.data,
  })

export function useUpdateAdminSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<PlatformSettings>) =>
      api.put<{ data: PlatformSettings }>('/admin/settings', input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['admin-settings'] }),
        client.invalidateQueries({ queryKey: ['platform'] }),
      ]),
  })
}

export const useSessions = () =>
  useQuery({
    queryKey: ['admin-sessions'],
    queryFn: ({ signal }) => api.get<{ data: SessionInfo[] }>('/admin/sessions', undefined, signal),
    select: (r) => r.data,
  })

export function useRevokeSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/admin/sessions/${id}`),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['admin-sessions'] }),
        client.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]),
  })
}
