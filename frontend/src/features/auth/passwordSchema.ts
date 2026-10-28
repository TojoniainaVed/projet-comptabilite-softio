import { z } from 'zod'

/** Mêmes règles que le serveur : longueur minimale (réglage de plateforme), majuscule, minuscule, chiffre. */
export function passwordSchema(minLength: number) {
  return z
    .string()
    .min(1, 'Le mot de passe est obligatoire.')
    .min(minLength, `Au moins ${minLength} caractères.`)
    .regex(/[a-z]/, 'Ajoutez au moins une minuscule.')
    .regex(/[A-Z]/, 'Ajoutez au moins une majuscule.')
    .regex(/\d/, 'Ajoutez au moins un chiffre.')
}

export const DEFAULT_PASSWORD_MIN = 12

export function passwordHint(minLength: number): string {
  return `${minLength} caractères minimum, avec majuscule, minuscule et chiffre.`
}
