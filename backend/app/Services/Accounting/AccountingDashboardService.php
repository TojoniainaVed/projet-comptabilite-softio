<?php

namespace App\Services\Accounting;

use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Indicateurs du tableau de bord financier, tous calculés sur les données réelles de l'entreprise. */
class AccountingDashboardService
{
    public function __construct(private readonly ReportService $reports) {}

    /** @return array<string, mixed> */
    public function summary(int $companyId): array
    {
        $today = CarbonImmutable::today();
        $monthStart = $today->startOfMonth();

        $month = $this->reports->incomeStatement($companyId, $monthStart->toDateString(), $today->toDateString());

        return [
            'treasury_total' => $this->reports->treasury($companyId)['total'],
            'receivable_outstanding' => $this->outstanding(Invoice::TYPE_CUSTOMER),
            'payable_outstanding' => $this->outstanding(Invoice::TYPE_SUPPLIER),
            'revenue_this_month' => $month['total_income'],
            'expenses_this_month' => $month['total_expenses'],
            'draft_entries' => JournalEntry::query()->where('status', JournalEntry::STATUS_DRAFT)->count(),
            'overdue_invoices' => Invoice::query()
                ->where('type', Invoice::TYPE_CUSTOMER)
                ->where('status', Invoice::STATUS_POSTED)
                ->whereDate('due_date', '<', $today->toDateString())
                ->count(),
            'monthly' => $this->monthlySeries($companyId, $today),
            'recent_entries' => JournalEntry::query()
                ->with('journal:id,code')
                ->latest('id')
                ->limit(5)
                ->get(['id', 'journal_id', 'reference', 'entry_date', 'description', 'status'])
                ->map(fn (JournalEntry $e) => [
                    'id' => $e->id,
                    'reference' => $e->reference,
                    'journal' => $e->journal?->code,
                    'entry_date' => $e->entry_date->toDateString(),
                    'description' => $e->description,
                    'status' => $e->status,
                ])->all(),
        ];
    }

    private function outstanding(string $type): string
    {
        $cents = Invoice::query()
            ->where('type', $type)
            ->where('status', Invoice::STATUS_POSTED)
            ->get(['total', 'amount_paid'])
            ->sum(fn (Invoice $i) => $i->amountDueCents());

        return Money::fromCents((int) $cents);
    }

    /** @return list<array{month:string, revenue:string, expenses:string}> six derniers mois, produits vs charges */
    private function monthlySeries(int $companyId, CarbonImmutable $today): array
    {
        $start = $today->startOfMonth()->subMonths(5);

        $rows = DB::table('journal_entry_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', ['posted', 'reversed'])
            ->whereIn('a.type', ['income', 'expense'])
            ->whereDate('e.entry_date', '>=', $start->toDateString())
            ->whereDate('e.entry_date', '<=', $today->toDateString())
            ->groupBy('e.entry_date', 'a.type')
            ->selectRaw('e.entry_date as day, a.type, SUM(l.debit) as debit, SUM(l.credit) as credit')
            ->get();

        $series = [];
        for ($i = 0; $i < 6; $i++) {
            $series[$start->addMonths($i)->format('Y-m')] = ['revenue' => 0, 'expenses' => 0];
        }

        foreach ($rows as $row) {
            $key = CarbonImmutable::parse($row->day)->format('Y-m');
            if (! isset($series[$key])) {
                continue;
            }
            $d = Money::toCents($row->debit);
            $c = Money::toCents($row->credit);
            if ($row->type === 'income') {
                $series[$key]['revenue'] += $c - $d;
            } else {
                $series[$key]['expenses'] += $d - $c;
            }
        }

        return collect($series)->map(fn (array $v, string $month) => [
            'month' => $month,
            'revenue' => Money::fromCents($v['revenue']),
            'expenses' => Money::fromCents($v['expenses']),
        ])->values()->all();
    }
}
