import { fromCents, toCents } from '@/lib/utils'

export interface DraftLine {
  debit: string
  credit: string
}

export interface EntryTotals {
  debit: string
  credit: string
  difference: string
  balanced: boolean
  /** Au moins une ligne porte un montant. */
  hasAmounts: boolean
}

/**
 * Totaux d'une saisie d'écriture, calculés en centimes entiers pour éviter les erreurs d'arrondi.
 * Indicateur d'aide à la saisie uniquement : l'équilibre est revalidé par l'API dans une transaction.
 */
export function computeEntryTotals(lines: DraftLine[]): EntryTotals {
  let debit = 0
  let credit = 0
  for (const line of lines) {
    debit += toCents(line.debit)
    credit += toCents(line.credit)
  }
  return {
    debit: fromCents(debit),
    credit: fromCents(credit),
    difference: fromCents(Math.abs(debit - credit)),
    balanced: debit === credit && debit > 0,
    hasAmounts: debit > 0 || credit > 0,
  }
}
