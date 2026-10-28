import { z } from 'zod'

const MONEY = /^\d{1,13}([.,]\d{1,2})?$/

/** Montant saisi : chiffres, séparateur « . » ou « , », 2 décimales maximum. Reste une chaîne. */
export const moneyString = (message = 'Montant invalide (2 décimales maximum).') =>
  z.string().trim().regex(MONEY, message)

/** Montant facultatif : champ vide accepté. */
export const optionalMoney = (message?: string) => z.union([z.literal(''), moneyString(message)])

export const positiveMoney = (message = 'Le montant doit être supérieur à zéro.') =>
  moneyString().refine((value) => Number(value.replace(',', '.')) > 0, message)

export const isoDate = (message = 'Date obligatoire.') => z.string().min(1, message)

/** Normalise une saisie monétaire pour l'API (virgule → point, vide → null). */
export function normalizeMoney(value: string): string {
  return value.trim().replace(',', '.')
}

export function normalizeOptionalMoney(value: string): string | null {
  const normalized = normalizeMoney(value)
  return normalized === '' ? null : normalized
}

export const emptyToNull = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}
