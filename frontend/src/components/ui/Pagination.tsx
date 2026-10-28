import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { PaginationMeta } from '@/types/api'

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta | undefined
  onPageChange: (page: number) => void
}) {
  if (!meta || meta.last_page <= 1) {
    return meta ? (
      <p className="px-4 py-3 text-xs text-ink-muted">
        {meta.total} résultat{meta.total > 1 ? 's' : ''}
      </p>
    ) : null
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-xs text-ink-muted">
        Page {meta.current_page} sur {meta.last_page} · {meta.total} résultats
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          Précédent
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          Suivant
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
