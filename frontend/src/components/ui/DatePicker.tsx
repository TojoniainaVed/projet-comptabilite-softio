import { forwardRef, type InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Input'

/**
 * Sélecteur de date basé sur l'input natif : accessible, localisé par le navigateur et compatible
 * mobile. Valeur au format ISO (AAAA-MM-JJ), identique à celui attendu par l'API.
 */
export const DatePicker = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function DatePicker(props, ref) {
  return <Input ref={ref} type="date" {...props} />
})
