import { fromCents, toCents } from '@/lib/utils'

export interface DraftInvoiceLine {
  quantity: string
  unit_price: string
  tax_rate: string
}

export interface InvoiceTotals {
  lines: { net: string; tax: string }[]
  subtotal: string
  tax: string
  total: string
}

const num = (value: string) => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Aperçu des totaux d'une facture (HT, TVA, TTC), avec la même règle d'arrondi par ligne que l'API.
 * L'API recalcule toujours les montants : ce résultat est purement indicatif.
 */
export function computeInvoiceTotals(lines: DraftInvoiceLine[]): InvoiceTotals {
  let subtotal = 0
  let tax = 0
  const computed = lines.map((line) => {
    const net = Math.round(num(line.quantity) * toCents(line.unit_price))
    const lineTax = Math.round((net * num(line.tax_rate)) / 100)
    subtotal += net
    tax += lineTax
    return { net: fromCents(net), tax: fromCents(lineTax) }
  })
  return {
    lines: computed,
    subtotal: fromCents(subtotal),
    tax: fromCents(tax),
    total: fromCents(subtotal + tax),
  }
}
