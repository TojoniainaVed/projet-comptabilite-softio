import { useEffect, useSyncExternalStore } from 'react'
import { preferencesStore } from '@/features/preferences/store'
import type { Preferences } from '@/features/preferences/preferences'

/** Préférences d'interface de l'utilisateur et leur modification (appliquée et enregistrée automatiquement). */
export function usePreferences() {
  const preferences = useSyncExternalStore(
    preferencesStore.subscribe,
    preferencesStore.get,
    preferencesStore.get,
  )
  return {
    preferences,
    update: (patch: Partial<Preferences>) => preferencesStore.update(patch),
    reset: () => preferencesStore.reset(),
  }
}

/** À la connexion : applique les préférences enregistrées dans le compte (elles font foi). */
export function useHydratePreferences(userId: number | undefined, stored: unknown): void {
  useEffect(() => {
    if (userId !== undefined && stored !== undefined) preferencesStore.hydrate(stored)
    // Uniquement à l'arrivée d'un utilisateur : les changements ultérieurs viennent du panneau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
}

/** Impose le thème clair le temps de la présence du composant (espace d'administration). */
export function useForceLightTheme(active: boolean): void {
  useEffect(() => {
    if (!active) return
    preferencesStore.forceTheme('light')
    return () => preferencesStore.forceTheme(undefined)
  }, [active])
}
