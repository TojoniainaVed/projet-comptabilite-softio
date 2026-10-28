import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

/** Les montants circulent en chaînes décimales (« 1234.50 ») : jamais d'arithmétique flottante côté UI. */
export function formatMoney(value: string | number | null | undefined, currency = 'MGA'): string {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'MGA' ? 'code' : 'symbol',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR').format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Convertit un montant saisi en centimes entiers (calculs d'équilibre côté interface uniquement). */
export function toCents(value: string | number | null | undefined): number {
  const normalized = String(value ?? '')
    .replace(',', '.')
    .trim()
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}
