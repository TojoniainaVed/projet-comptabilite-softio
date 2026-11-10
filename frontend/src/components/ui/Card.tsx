import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  actions?: ReactNode
  padded?: boolean
}

export function Card({ title, actions, padded = true, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn('rounded-card border border-line bg-surface shadow-card', className)}
      {...props}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </header>
      )}

      <div className={cn(padded && 'p-4')}>{children}</div>
    </section>
  )
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>

        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
      </div>

      <p className="tabular mt-1.5 text-xl font-semibold text-ink">{value}</p>

      {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
    </div>
  )
}
