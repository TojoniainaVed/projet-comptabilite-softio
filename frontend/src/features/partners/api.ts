import { createResource } from '@/lib/resource'
import type { Partner } from '@/types/api'

export interface PartnerInput {
  name: string
  email: string | null
  phone: string | null
  tax_id: string | null
  address: string | null
  is_active: boolean
}

export const customersApi = createResource<Partner, PartnerInput>('customers', '/customers')
export const suppliersApi = createResource<Partner, PartnerInput>('suppliers', '/suppliers')
