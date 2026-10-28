<?php

namespace App\Services\Accounting;

use App\Models\Account;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Rapports calculés exclusivement à partir des écritures validées (statuts posted et reversed :
 * une écriture contrepassée et sa contrepartie s'annulent mutuellement).
 *
 * Ces requêtes passent par le query builder : le filtre d'entreprise est donc appliqué explicitement.
 */
class ReportService
{
    /** @return array{rows: list<array<string, mixed>>, totals: array<string, string>} */
    public function trialBalance(int $companyId, ?string $from = null, ?string $to = null): array
    {
        $rows = [];
        $debit = 0;
        $credit = 0;

        foreach ($this->movements($companyId, $from, $to) as $row) {
            $d = Money::toCents($row->debit);
            $c = Money::toCents($row->credit);
            $debit += $d;
            $credit += $c;

            $rows[] = [
                'account_id' => $row->id,
                'code' => $row->code,
                'name' => $row->name,
                'type' => $row->type,
                'debit' => Money::fromCents($d),
                'credit' => Money::fromCents($c),
                'balance_debit' => Money::fromCents(max($d - $c, 0)),
                'balance_credit' => Money::fromCents(max($c - $d, 0)),
            ];
        }

        return [
            'rows' => $rows,
            'totals' => [
                'debit' => Money::fromCents($debit),
                'credit' => Money::fromCents($credit),
                'balanced' => $debit === $credit ? 'true' : 'false',
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function incomeStatement(int $companyId, ?string $from = null, ?string $to = null): array
    {
        $income = [];
        $expenses = [];
        $incomeTotal = 0;
        $expenseTotal = 0;

        foreach ($this->movements($companyId, $from, $to, ['income', 'expense']) as $row) {
            $d = Money::toCents($row->debit);
            $c = Money::toCents($row->credit);

            if ($row->type === 'income') {
                $amount = $c - $d;
                $incomeTotal += $amount;
                $income[] = $this->line($row, $amount);
            } else {
                $amount = $d - $c;
                $expenseTotal += $amount;
                $expenses[] = $this->line($row, $amount);
            }
        }

        return [
            'income' => $income,
            'expenses' => $expenses,
            'total_income' => Money::fromCents($incomeTotal),
            'total_expenses' => Money::fromCents($expenseTotal),
            'net_result' => Money::fromCents($incomeTotal - $expenseTotal),
        ];
    }

    /**
     * Bilan à une date. Le résultat non clôturé (produits − charges cumulés) est présenté dans les capitaux propres :
     * la clôture d'exercice n'est pas automatisée dans ce socle.
     *
     * @return array<string, mixed>
     */
    public function balanceSheet(int $companyId, string $asOf): array
    {
        $assets = [];
        $liabilities = [];
        $equity = [];
        $totals = ['asset' => 0, 'liability' => 0, 'equity' => 0, 'income' => 0, 'expense' => 0];

        foreach ($this->movements($companyId, null, $asOf) as $row) {
            $d = Money::toCents($row->debit);
            $c = Money::toCents($row->credit);

            match ($row->type) {
                'asset' => $assets[] = $this->line($row, $d - $c),
                'liability' => $liabilities[] = $this->line($row, $c - $d),
                'equity' => $equity[] = $this->line($row, $c - $d),
                default => null,
            };

            $totals[$row->type] += in_array($row->type, ['asset', 'expense'], true) ? $d - $c : $c - $d;
        }

        $result = $totals['income'] - $totals['expense'];
        $equityTotal = $totals['equity'] + $result;
        $liabilitiesAndEquity = $totals['liability'] + $equityTotal;

        return [
            'as_of' => $asOf,
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'unclosed_result' => Money::fromCents($result),
            'total_assets' => Money::fromCents($totals['asset']),
            'total_liabilities' => Money::fromCents($totals['liability']),
            'total_equity' => Money::fromCents($equityTotal),
            'total_liabilities_and_equity' => Money::fromCents($liabilitiesAndEquity),
            'balanced' => $totals['asset'] === $liabilitiesAndEquity,
        ];
    }

    /** @return array{accounts: list<array<string, mixed>>, total: string} */
    public function treasury(int $companyId): array
    {
        $balances = $this->movements($companyId, null, null)->keyBy('id');
        $accounts = [];
        $total = 0;

        $treasuryAccounts = Account::query()
            ->where('company_id', $companyId)
            ->whereIn('category', ['bank', 'cash'])
            ->orderBy('code')
            ->get();

        foreach ($treasuryAccounts as $account) {
            $row = $balances->get($account->id);
            $balance = $row ? Money::toCents($row->debit) - Money::toCents($row->credit) : 0;
            $total += $balance;
            $accounts[] = [
                'account_id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'category' => $account->category,
                'balance' => Money::fromCents($balance),
            ];
        }

        return ['accounts' => $accounts, 'total' => Money::fromCents($total)];
    }

    /**
     * Mouvements cumulés par compte.
     *
     * @param  list<string>|null  $types
     * @return Collection<int, object>
     */
    public function movements(int $companyId, ?string $from, ?string $to, ?array $types = null): Collection
    {
        return DB::table('journal_entry_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', ['posted', 'reversed'])
            ->when($from, fn ($q) => $q->whereDate('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('e.entry_date', '<=', $to))
            ->when($types, fn ($q) => $q->whereIn('a.type', $types))
            ->groupBy('a.id', 'a.code', 'a.name', 'a.type', 'a.category')
            ->orderBy('a.code')
            ->selectRaw('a.id, a.code, a.name, a.type, a.category, SUM(l.debit) as debit, SUM(l.credit) as credit')
            ->get();
    }

    /** @return array{account_id:int, code:string, name:string, amount:string} */
    private function line(object $row, int $amountCents): array
    {
        return [
            'account_id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'amount' => Money::fromCents($amountCents),
        ];
    }
}
