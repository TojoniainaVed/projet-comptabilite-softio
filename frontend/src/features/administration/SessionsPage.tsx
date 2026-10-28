import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/feedback/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/form-errors'
import { formatDateTime } from '@/lib/utils'
import { useRevokeSession, useSessions } from '@/features/administration/api'
import type { SessionInfo } from '@/types/api'

export function SessionsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const query = useSessions()
  const revoke = useRevokeSession()
  const [target, setTarget] = useState<SessionInfo | null>(null)

  const onRevoke = async () => {
    if (!target) return
    try {
      await revoke.mutateAsync(target.id)
      toast.success('Session fermée.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setTarget(null)
    }
  }

  const columns: Column<SessionInfo>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      cell: (s) => (
        <div>
          <p className="font-medium">{s.user.name}</p>
          <p className="text-xs text-ink-muted">{s.user.email}</p>
        </div>
      ),
    },
    { key: 'device', header: 'Appareil', cell: (s) => s.device },
    { key: 'created', header: 'Ouverte le', cell: (s) => formatDateTime(s.created_at) },
    { key: 'used', header: 'Dernière activité', cell: (s) => formatDateTime(s.last_used_at) },
    { key: 'expires', header: 'Expire le', cell: (s) => formatDateTime(s.expires_at) },
    {
      key: 'current',
      header: '',
      cell: (s) => (s.is_current ? <Badge tone="info">Session actuelle</Badge> : null),
    },
    ...(can('sessions.administer')
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (s: SessionInfo) =>
              s.is_current ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<LogOut className="size-4" aria-hidden="true" />}
                  onClick={() => setTarget(s)}
                  aria-label={`Fermer la session de ${s.user.name}`}
                >
                  Fermer
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Sessions actives"
        description="Jetons d'accès non expirés. Fermer une session déconnecte immédiatement l'appareil concerné."
      />
      <Card padded={false}>
        <DataTable
          caption="Sessions actives"
          columns={columns}
          rows={query.data}
          rowKey={(s) => s.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucune session active"
        />
      </Card>
      <ConfirmDialog
        open={target !== null}
        title="Fermer la session"
        message={`La session de ${target?.user.name ?? ''} sera révoquée immédiatement.`}
        confirmLabel="Fermer la session"
        danger
        loading={revoke.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => void onRevoke()}
      />
    </>
  )
}
