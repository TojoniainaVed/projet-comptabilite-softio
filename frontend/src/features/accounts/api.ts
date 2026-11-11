import { createResource } from '@/lib/resource'
import type { Account, AccountType } from '@/types/api'

export interface AccountInput {
  code: string
  name: string
  type: AccountType
  category: string | null
  parent_id: number | null
  is_group: boolean
  is_active: boolean
}

export const accountsApi = createResource<Account, AccountInput>(
  'accounts',
  '/accounts',
)