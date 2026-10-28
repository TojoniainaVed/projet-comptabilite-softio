/**
 * Le jeton d'API est conservé dans sessionStorage : il disparaît à la fermeture de l'onglet et
 * n'est pas partagé entre onglets. Compromis assumé (voir docs/ARCHITECTURE.md) : un cookie httpOnly
 * serait plus robuste face au XSS mais impose une API de même domaine.
 */
const KEY = 'softio.token'

export const authStorage = {
  get(): string | null {
    try {
      return sessionStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    try {
      sessionStorage.setItem(KEY, token)
    } catch {
      /* stockage indisponible : la session ne survivra pas au rechargement */
    }
  },
  clear(): void {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* rien à faire */
    }
  },
}
