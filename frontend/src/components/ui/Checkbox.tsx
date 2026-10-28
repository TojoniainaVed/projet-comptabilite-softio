import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="size-4 rounded-xs border-line accent-brand-600"
        {...props}
      />
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
      </label>
    </div>
  )
})
