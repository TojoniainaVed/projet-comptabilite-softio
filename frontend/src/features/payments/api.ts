import { createResource } from '@/lib/resource'
import type { Payment } from '@/types/api'

export const paymentsApi = createResource<Payment>('payments', '/payments')
