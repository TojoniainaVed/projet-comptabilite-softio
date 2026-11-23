/** Périodes rapides des rapports (dates locales au format AAAA-MM-JJ). */

export type PeriodPreset = 'month' | 'quarter' | 'year' | 'last-year'

export const periodPresetLabels: Record<PeriodPreset, string> = {
  month: 'Ce mois',
  quarter: 'Ce trimestre',
  year: 'Cette année',
  'last-year': 'Année précédente',
}

function iso(year: number, month: number, day: number): string {
  // Date locale (month : 0-11) : évite le décalage de fuseau d'un toISOString().
  const date = new Date(year, month, day)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function presetRange(preset: PeriodPreset, now = new Date()): { from: string; to: string } {
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (preset) {
    case 'month':
      return { from: iso(year, month, 1), to: iso(year, month + 1, 0) }
    case 'quarter': {
      const start = Math.floor(month / 3) * 3
      return { from: iso(year, start, 1), to: iso(year, start + 3, 0) }
    }
    case 'year':
      return { from: iso(year, 0, 1), to: iso(year, 11, 31) }
    case 'last-year':
      return { from: iso(year - 1, 0, 1), to: iso(year - 1, 11, 31) }
  }
}

/** Classe du plan comptable (premier chiffre du code) : regroupement de la balance. */
export const accountClassLabels: Record<string, string> = {
  '1': 'Classe 1 · Comptes de capitaux',
  '2': 'Classe 2 · Immobilisations',
  '3': 'Classe 3 · Stocks et en-cours',
  '4': 'Classe 4 · Comptes de tiers',
  '5': 'Classe 5 · Comptes financiers',
  '6': 'Classe 6 · Charges',
  '7': 'Classe 7 · Produits',
}

export function accountClassLabel(code: string): string {
  return accountClassLabels[code.charAt(0)] ?? 'Autres comptes'
}
