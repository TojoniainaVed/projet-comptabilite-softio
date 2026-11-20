/** Adresse du front de Softio (projet principal). */
export const SOFTIO_URL = (import.meta.env.VITE_SOFTIO_URL ?? 'http://localhost:5173').replace(
  /\/$/,
  '',
)

/** Renvoie vers l'espace Softio de l'utilisateur (Softio l'oriente selon son rôle). */
export function retournerVersSoftio(): void {
  window.location.assign(`${SOFTIO_URL}/dashboard`)
}
