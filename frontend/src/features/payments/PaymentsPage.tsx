import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  FileText,
  RotateCcw,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'

import { useListParams } from '@/hooks/useListParams'
import { paymentMethodLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { paymentsApi } from '@/features/payments/api'
import { formatDate, formatMoney } from '@/lib/utils'
import { invoiceBasePath } from '@/features/invoices/api'
import type { Payment } from '@/types/api'

export function PaymentsPage() {
  // Encaissements affichés par défaut.
  // Les décaissements sont consultés séparément.
  const list = useListParams({ direction: 'in' })

  const query = paymentsApi.useList({
    ...list.params,
    per_page: 25,
  })

  const isIncoming = list.filters.direction === 'in'

  // Colonnes du tableau des paiements.
  const columns: Column<Payment>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (payment) => (
        <span className="whitespace-nowrap font-medium">{formatDate(payment.paid_on)}</span>
      ),
    },
    {
      key: 'invoice',
      header: 'Facture',
      cell: (payment) =>
        payment.invoice ? (
          <Link
            className="font-medium text-brand-700 hover:underline"
            to={`${invoiceBasePath(payment.invoice.type)}/${payment.invoice.id}`}
          >
            {payment.invoice.number ?? `#${payment.invoice.id}`}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'method',
      header: 'Mode de paiement',
      cell: (payment) => paymentMethodLabels[payment.method] ?? payment.method,
    },
    {
      key: 'account',
      header: 'Compte de trésorerie',
      cell: (payment) =>
        payment.treasury_account ? (
          <div>
            <p className="font-medium text-ink">{payment.treasury_account.name}</p>
            <p className="text-xs text-ink-muted">{payment.treasury_account.code}</p>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'reference',
      header: 'Référence',
      cell: (payment) => payment.reference || '—',
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      cell: (payment) => (
        <span className="font-semibold tabular">{formatMoney(payment.amount)}</span>
      ),
    },
  ]

  // Réinitialisation des deux filtres de dates.
  function resetDates() {
    list.setFilter('from', '')
    list.setFilter('to', '')
  }

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Gestion et suivi des règlements clients et fournisseurs."
        actions={
          <>
            <Link
              to="/sales/invoices"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <ArrowDownLeft className="size-4" aria-hidden="true" />
              Nouvel encaissement
            </Link>

            <Link
              to="/purchases/invoices"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
              Nouveau décaissement
            </Link>
          </>
        }
      />

      {/* Présentation du rôle du menu */}
      <Card padded={false} className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Wallet className="size-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Suivi des règlements</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Consultez les sommes reçues des clients et les paiements effectués auprès des
              fournisseurs. Les nouveaux règlements sont enregistrés depuis leurs factures
              respectives.
            </p>
          </div>
        </div>
      </Card>

      {/* Indicateurs de suivi */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Paiements trouvés"
          value={query.data?.meta ? query.data.meta.total.toLocaleString('fr-FR') : '—'}
          hint="Nombre de résultats correspondant aux filtres"
          icon={<FileText className="size-5" />}
        />

        <StatCard
          label="Type de règlement"
          value={isIncoming ? 'Encaissements' : 'Décaissements'}
          hint={
            isIncoming ? 'Règlements reçus des clients' : 'Règlements effectués aux fournisseurs'
          }
          icon={
            isIncoming ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />
          }
        />
      </div>

      {/* Filtres */}
      <Card
        title="Filtres et période"
        actions={
          <button
            type="button"
            onClick={resetDates}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Réinitialiser les dates
          </button>
        }
        padded={false}
        className="mb-5"
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="payment-direction" className="text-xs font-medium text-ink-muted">
              Type de règlement
            </label>

            <Select
              id="payment-direction"
              value={list.filters.direction}
              onChange={(event) => list.setFilter('direction', event.target.value)}
            >
              <option value="in">Encaissements clients</option>
              <option value="out">Décaissements fournisseurs</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="payment-from" className="text-xs font-medium text-ink-muted">
              Date de début
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />

              <DatePicker
                id="payment-from"
                aria-label="Date de début"
                className="pl-9"
                value={list.filters.from ?? ''}
                onChange={(event) => list.setFilter('from', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="payment-to" className="text-xs font-medium text-ink-muted">
              Date de fin
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />

              <DatePicker
                id="payment-to"
                aria-label="Date de fin"
                className="pl-9"
                value={list.filters.to ?? ''}
                onChange={(event) => list.setFilter('to', event.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Historique */}
      <Card
        title={isIncoming ? 'Historique des encaissements' : 'Historique des décaissements'}
        actions={
          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">
            {query.data?.meta ? `${query.data.meta.total} résultat(s)` : 'Chargement...'}
          </span>
        }
        padded={false}
      >
        <DataTable
          caption={
            isIncoming
              ? 'Historique des encaissements clients'
              : 'Historique des décaissements fournisseurs'
          }
          columns={columns}
          rows={query.data?.data}
          rowKey={(payment) => payment.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle={isIncoming ? 'Aucun encaissement trouvé' : 'Aucun décaissement trouvé'}
          emptyDescription={
            isIncoming
              ? 'Aucun règlement client ne correspond à cette période.'
              : 'Aucun règlement fournisseur ne correspond à cette période.'
          }
        />

        <Pagination meta={query.data?.meta} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
