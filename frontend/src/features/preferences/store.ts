import { api } from '@/lib/api-client'
import {
  applyPreferences,
  defaultPreferences,
  sanitizePreferences,
  type Preferences,
} from '@/features/preferences/preferences'

/**
 * Magasin des préférences d'interface (hors React, pour s'appliquer avant le premier affichage).
 * - la copie du navigateur évite le clignotement au chargement ;
 * - le compte de l'utilisateur fait foi : il est appliqué à la connexion (hydrate) et mis à jour par update().
 */
const STORAGE_KEY = 'softio.preferences'
const SAVE_DELAY_MS = 600

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizePreferences(JSON.parse(raw)) : defaultPreferences
  } catch {
    return defaultPreferences
  }
}

function remember(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Stockage indisponible (navigation privée...) : le compte reste la référence.
  }
}

let state: Preferences = load()
let forcedTheme: 'light' | 'dark' | undefined
const listeners = new Set<() => void>()
let pending: Partial<Preferences> = {}
let timer: ReturnType<typeof setTimeout> | undefined

function commit(next: Preferences): void {
  state = next
  remember(next)
  applyPreferences(next, forcedTheme)
  listeners.forEach((listener) => listener())
}

function flush(): void {
  const body = pending
  pending = {}
  timer = undefined
  if (Object.keys(body).length === 0) return
  // Un échec réseau n'annule pas le réglage local : il sera renvoyé au prochain changement.
  api.put('/auth/preferences', body).catch(() => {
    pending = { ...body, ...pending }
  })
}

export const preferencesStore = {
  get: (): Preferences => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Modifie des réglages : appliqués tout de suite, enregistrés dans le compte peu après. */
  update(patch: Partial<Preferences>): void {
    commit({ ...state, ...patch })
    pending = { ...pending, ...patch }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  },

  reset(): void {
    this.update({ ...defaultPreferences })
  },

  /** Applique les préférences du compte (à la connexion), sans les renvoyer au serveur. */
  hydrate(raw: unknown): void {
    commit(sanitizePreferences(raw))
  },

  /** L'espace d'administration reste en thème clair, quel que soit le réglage de l'utilisateur. */
  forceTheme(theme: 'light' | 'dark' | undefined): void {
    forcedTheme = theme
    applyPreferences(state, forcedTheme)
  },
}

applyPreferences(state)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') applyPreferences(state, forcedTheme)
  })
}
