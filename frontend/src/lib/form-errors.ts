import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api-client'

/**
 * Reporte les erreurs de validation de l'API (422) sur les champs du formulaire.
 * Retourne un message général lorsque l'erreur n'est pas rattachable à un champ.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!(error instanceof ApiError)) return 'Une erreur inattendue est survenue.'
  if (!error.isValidation) return error.message

  for (const [field, messages] of Object.entries(error.errors)) {
    setError(field as Path<T>, { type: 'server', message: messages[0] })
  }
  return null
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
}
