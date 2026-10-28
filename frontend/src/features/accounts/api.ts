import { createResource } from '@/lib/resource'
import type { Account } from '@/types/api'

export interface AccountInput {
  code: string
  name: string
  type: string
  category: string | null
  is_active: boolean
}

export const accountsApi = createResource<Account, AccountInput>('accounts', '/accounts')
