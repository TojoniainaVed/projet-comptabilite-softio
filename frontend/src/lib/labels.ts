import type { AccountCategory, AccountType, JournalType, PaymentMethod } from '@/types/api'

export const accountTypeLabels: Record<AccountType, string> = {
  asset: 'Actif',
  liability: 'Passif',
  equity: 'Capitaux propres',
  income: 'Produit',
  expense: 'Charge',
}

export const accountCategoryLabels: Record<AccountCategory, string> = {
  receivable: 'Clients',
  payable: 'Fournisseurs',
  bank: 'Banque',
  cash: 'Caisse',
  vat_collected: 'TVA collectée',
  vat_deductible: 'TVA déductible',
}

export const journalTypeLabels: Record<JournalType, string> = {
  sales: 'Ventes',
  purchases: 'Achats',
  bank: 'Banque',
  cash: 'Caisse',
  general: 'Opérations diverses',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: 'Virement',
  cash: 'Espèces',
  check: 'Chèque',
  card: 'Carte',
}

export const optionsOf = <T extends string>(
  labels: Record<T, string>,
): { value: T; label: string }[] =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))
