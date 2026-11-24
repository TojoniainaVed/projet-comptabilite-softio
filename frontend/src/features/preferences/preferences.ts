import type {
  AccentColor,
  SidebarStyle,
  StatusColorName,
  StatusColors,
  StatusKey,
  ThemeMode,
  UserPreferences,
} from '@/types/api'

export type Preferences = UserPreferences

export const defaultStatusColors: StatusColors = {
  draft: 'black',
  validated: 'green',
  paid: 'blue',
  cancelled: 'red',
  reversed: 'orange',
}

export const statusOptions: { key: StatusKey; label: string }[] = [
  { key: 'draft', label: 'Brouillon' },
  { key: 'validated', label: 'Validé' },
  { key: 'paid', label: 'Payé' },
  { key: 'cancelled', label: 'Annulé' },
  { key: 'reversed', label: 'Contrepassé' },
]

export const statusColorOptions: { value: StatusColorName; label: string; hex: string }[] = [
  { value: 'black', label: 'Noir', hex: '#1f2937' },
  { value: 'gray', label: 'Gris', hex: '#6b7280' },
  { value: 'green', label: 'Vert', hex: '#16a34a' },
  { value: 'teal', label: 'Turquoise', hex: '#0d9488' },
  { value: 'blue', label: 'Bleu', hex: '#2563eb' },
  { value: 'violet', label: 'Violet', hex: '#7c3aed' },
  { value: 'rose', label: 'Rose', hex: '#e11d48' },
  { value: 'red', label: 'Rouge', hex: '#dc2626' },
  { value: 'orange', label: 'Orange', hex: '#ea580c' },
]

export const defaultPreferences: Preferences = {
  theme: 'light',
  accent: 'teal',
  sidebar: 'green',
  density: 'comfortable',
  font_size: 'normal',
  sidebar_collapsed: false,
  status_colors: defaultStatusColors,
}

export const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
]

/** `swatch` : couleur affichée dans le panneau (la couleur réelle est définie dans themes.css). */
export const accentOptions: { value: AccentColor; label: string; swatch: string }[] = [
  { value: 'teal', label: 'Vert Softio', swatch: '#087d79' },
  { value: 'blue', label: 'Bleu', swatch: '#2563eb' },
  { value: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { value: 'orange', label: 'Orange', swatch: '#ea580c' },
  { value: 'rose', label: 'Rose', swatch: '#e11d48' },
  { value: 'slate', label: 'Ardoise', swatch: '#475569' },
]

export const sidebarOptions: { value: SidebarStyle; label: string; swatch: string }[] = [
  { value: 'green', label: 'Vert Softio', swatch: '#075d5a' },
  { value: 'accent', label: 'Couleur d’accent', swatch: 'var(--color-brand-700)' },
  { value: 'dark', label: 'Sombre', swatch: '#16232a' },
  { value: 'light', label: 'Clair', swatch: '#ffffff' },
]

export const densityOptions: { value: Preferences['density']; label: string }[] = [
  { value: 'comfortable', label: 'Confortable' },
  { value: 'compact', label: 'Compacte' },
]

export const fontSizeOptions: { value: Preferences['font_size']; label: string }[] = [
  { value: 'small', label: 'Petite' },
  { value: 'normal', label: 'Normale' },
  { value: 'large', label: 'Grande' },
]

const allowed = {
  theme: themeOptions.map((o) => o.value as string),
  accent: accentOptions.map((o) => o.value as string),
  sidebar: sidebarOptions.map((o) => o.value as string),
  density: densityOptions.map((o) => o.value as string),
  font_size: fontSizeOptions.map((o) => o.value as string),
}

/** Valide des préférences venues du stockage ou du serveur : toute valeur inconnue revient au défaut. */
export function sanitizePreferences(raw: unknown): Preferences {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const result: Preferences = { ...defaultPreferences }

  for (const key of Object.keys(allowed) as (keyof typeof allowed)[]) {
    const value = source[key]
    if (typeof value === 'string' && allowed[key].includes(value)) {
      ;(result as unknown as Record<string, unknown>)[key] = value
    }
  }
  if (typeof source.sidebar_collapsed === 'boolean') {
    result.sidebar_collapsed = source.sidebar_collapsed
  }
  const colors = (source.status_colors ?? {}) as Record<string, unknown>
  const valid = statusColorOptions.map((o) => o.value as string)
  result.status_colors = { ...defaultStatusColors }
  for (const { key } of statusOptions) {
    const value = colors[key]
    if (typeof value === 'string' && valid.includes(value)) {
      result.status_colors[key] = value as StatusColorName
    }
  }
  return result
}

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/** Applique les préférences à la page : themes.css réagit à ces attributs de l'élément <html>. */
export function applyPreferences(preferences: Preferences, forceTheme?: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const theme = forceTheme ?? resolveTheme(preferences.theme)
  root.dataset.theme = theme
  root.dataset.accent = preferences.accent
  root.dataset.sidebar = preferences.sidebar
  root.dataset.density = preferences.density
  root.dataset.font = preferences.font_size
  root.style.colorScheme = theme
}
