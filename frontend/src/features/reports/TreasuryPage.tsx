import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Banknote,
  Building2,
  RefreshCw,
  Wallet,
  CreditCard,
  Landmark,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card, StatCard } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'

import { accountCategoryLabels } from '@/lib/labels'
import { errorMessage } from '@/lib/form-errors'
import { formatMoney } from '@/lib/utils'
import { useTreasury } from '@/features/reports/api'

import type { AccountCategory, TreasuryReport } from '@/types/api'

type TreasuryAccount = TreasuryReport['accounts'][number]
type AccountFilter = 'all' | 'bank' | 'cash'

export function TreasuryPage() {
  const query = useTreasury()
  const [filter, setFilter] = useState<AccountFilter>('all')

  const accounts = query.data?.accounts ?? []

  const bankAccounts = useMemo(
    () => accounts.filter((account) => account.category === 'bank'),
    [accounts],
  )

  const cashAccounts = useMemo(
    () => accounts.filter((account) => account.category === 'cash'),
    [accounts],
  )

  const bankTotal = useMemo(
    () => bankAccounts.reduce((total, account) => total + Number(account.balance || 0), 0),
    [bankAccounts],
  )

  const cashTotal = useMemo(
    () => cashAccounts.reduce((total, account) => total + Number(account.balance || 0), 0),
    [cashAccounts],
  )

  const visibleAccounts = useMemo(() => {
    if (filter === 'bank') return bankAccounts
    if (filter === 'cash') return cashAccounts
    return accounts
  }, [accounts, bankAccounts, cashAccounts, filter])

  const columns: Column<TreasuryAccount>[] = [
    {
      key: 'code',
      header: 'Code du compte',
      cell: (account) => <span className="font-mono font-semibold text-ink">{account.code}</span>,
    },
    {
      key: 'name',
      header: 'Intitulé du compte',
      cell: (account) => (
        <div className="flex items-center gap-2">
          <span
            className={[
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              account.category === 'bank'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-emerald-50 text-emerald-700',
            ].join(' ')}
          >
            {account.category === 'bank' ? (
              <Landmark className="size-4" />
            ) : (
              <Wallet className="size-4" />
            )}
          </span>
          <span className="font-medium">{account.name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Nature',
      cell: (account) => (
        <span
          className={[
            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
            account.category === 'bank'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-emerald-50 text-emerald-700',
          ].join(' ')}
        >
          {accountCategoryLabels[account.category as AccountCategory] ?? account.category}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Solde disponible',
      align: 'right',
      cell: (account) => (
        <span className="font-semibold tabular text-ink">{formatMoney(account.balance)}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description="Suivez les soldes de vos comptes bancaires et de caisse à partir des écritures comptables validées."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Actualiser
          </Button>
        }
      />

      {/* Indicateurs principaux */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Trésorerie totale"
          value={query.data ? formatMoney(query.data.total) : '—'}
          hint="Ensemble des soldes bancaires et de caisse"
          icon={<Wallet className="size-5 text-primary" />}
        />

        <StatCard
          label="Comptes bancaires"
          value={query.data ? formatMoney(bankTotal) : '—'}
          hint={`${bankAccounts.length} compte(s) bancaire(s)`}
          icon={<Building2 className="size-5 text-blue-600" />}
        />

        <StatCard
          label="Comptes de caisse"
          value={query.data ? formatMoney(cashTotal) : '—'}
          hint={`${cashAccounts.length} compte(s) de caisse`}
          icon={<Banknote className="size-5 text-emerald-600" />}
        />
      </div>

      {/* Accès rapides */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/payments"
          className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-primary/40 hover:shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-ink">Consulter les paiements</p>
              <p className="mt-1 text-xs text-ink-muted">Encaissements et décaissements</p>
            </div>
          </div>
          <ArrowLeftRight className="size-5 text-ink-muted transition group-hover:text-primary" />
        </Link>

        <Link
          to="/accounts"
          className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-primary/40 hover:shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-ink">Gérer les comptes</p>
              <p className="mt-1 text-xs text-ink-muted">Consulter le plan comptable</p>
            </div>
          </div>
          <ArrowLeftRight className="size-5 text-ink-muted transition group-hover:text-primary" />
        </Link>
      </div>

      {/* Comptes de trésorerie */}
      <Card padded={false}>
        <div className="space-y-4 border-b border-line p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Mes comptes de trésorerie</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Vue d'ensemble des comptes de banque et de caisse.
              </p>
            </div>

            <span className="text-xs text-ink-muted">{accounts.length} compte(s)</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: 'all', label: 'Tous les comptes', count: accounts.length },
                { value: 'bank', label: 'Banques', count: bankAccounts.length },
                { value: 'cash', label: 'Caisses', count: cashAccounts.length },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
                  filter === item.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-line bg-surface text-ink-muted hover:bg-canvas',
                ].join(' ')}
              >
                {item.label}
                <span className="rounded-md bg-canvas px-1.5 py-0.5 text-xs">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        <DataTable
          caption="Liste des comptes de trésorerie"
          columns={columns}
          rows={visibleAccounts}
          rowKey={(account) => account.account_id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          emptyTitle={
            filter === 'bank'
              ? 'Aucun compte bancaire'
              : filter === 'cash'
                ? 'Aucun compte de caisse'
                : 'Aucun compte de trésorerie'
          }
          emptyDescription="Ajoutez un compte avec le rôle Banque ou Caisse dans le plan comptable pour le faire apparaître ici."
        />

        <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          Les soldes affichés proviennent des écritures comptables validées.
        </div>
      </Card>
    </>
  )
}
