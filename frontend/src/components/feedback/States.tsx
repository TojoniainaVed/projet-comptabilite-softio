import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="size-8 text-ink-muted" aria-hidden="true" />
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message = 'Une erreur est survenue lors du chargement.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden="true" />
      <p className="font-medium text-ink">Impossible d'afficher les données</p>
      <p className="max-w-md text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Réessayer
        </Button>
      )}
    </div>
  )
}

export function InlineAlert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'info'
  children: ReactNode
}) {
  const styles =
    tone === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-info/30 bg-info/10 text-info'
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-control border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </div>
  )
}
