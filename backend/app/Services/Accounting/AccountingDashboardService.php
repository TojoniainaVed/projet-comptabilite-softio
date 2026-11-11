<?php

namespace App\Services\Accounting;

use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AccountingDashboardService
{
    public function __construct(
        private readonly ReportService $reports
    ) {}

    /**
     * Indicateurs du tableau de bord comptable d'une entreprise.
     *
     * @return array<string, mixed>
     */
    public function summary(int $companyId): array
    {
        if ($companyId <= 0) {
            abort(404);
        }

        // Un utilisateur authentifiÃ© ne peut consulter que son entreprise.
        // En console, Auth::user() peut Ãªtre null : les requÃªtes utilisent
        // alors obligatoirement le companyId transmis.
        $user = Auth::user();

        if (
            $user !== null
            && (int) $user->company_id !== $companyId
        ) {
            abort(404);
        }

        $today = CarbonImmutable::today();
        $monthStart = $today->startOfMonth();

        $month = $this->reports->incomeStatement(
            $companyId,
            $monthStart->toDateString(),
            $today->toDateString()
        );

        $netResult = Money::fromCents(
            Money::toCents($month['total_income'])
            - Money::toCents($month['total_expenses'])
        );

        return [
            'treasury_total' => $this->reports->treasury($companyId)['total'],

            'receivable_outstanding' => $this->outstanding(
                $companyId,
                Invoice::TYPE_CUSTOMER
            ),

            'payable_outstanding' => $this->outstanding(
                $companyId,
                Invoice::TYPE_SUPPLIER
            ),

            'revenue_this_month' => $month['total_income'],
            'expenses_this_month' => $month['total_expenses'],
            'net_result_this_month' => $netResult,

            'draft_entries' => JournalEntry::query()
                ->where('company_id', $companyId)
                ->where('status', JournalEntry::STATUS_DRAFT)
                ->count(),

            'overdue_customer_invoices' => $this->overdueInvoices(
                $companyId,
                Invoice::TYPE_CUSTOMER,
                $today
            ),

            'overdue_supplier_invoices' => $this->overdueInvoices(
                $companyId,
                Invoice::TYPE_SUPPLIER,
                $today
            ),

            'monthly' => $this->monthlySeries($companyId, $today),

            'recent_entries' => JournalEntry::query()
                ->where('company_id', $companyId)
                ->with('journal:id,code')
                ->latest('id')
                ->limit(5)
                ->get([
                    'id',
                    'journal_id',
                    'reference',
                    'entry_date',
                    'description',
                    'status',
                ])
                ->map(fn (JournalEntry $entry) => [
                    'id' => $entry->id,
                    'reference' => $entry->reference,
                    'journal' => $entry->journal?->code,
                    'entry_date' => $entry->entry_date->toDateString(),
                    'description' => $entry->description,
                    'status' => $entry->status,
                ])
                ->all(),
        ];
    }

    /**
     * Montant restant Ã  payer des factures validÃ©es d'une entreprise.
     */
    private function outstanding(int $companyId, string $type): string
    {
        $cents = Invoice::query()
            ->where('company_id', $companyId)
            ->where('type', $type)
            ->where('status', Invoice::STATUS_POSTED)
            ->get(['total', 'amount_paid'])
            ->sum(
                fn (Invoice $invoice) => $invoice->amountDueCents()
            );

        return Money::fromCents((int) $cents);
    }

    /**
     * Nombre de factures validÃ©es, Ã©chues et ayant encore un solde Ã  payer.
     */
    private function overdueInvoices(
        int $companyId,
        string $type,
        CarbonImmutable $today
    ): int {
        return Invoice::query()
            ->where('company_id', $companyId)
            ->where('type', $type)
            ->where('status', Invoice::STATUS_POSTED)
            ->whereDate('due_date', '<', $today->toDateString())
            ->get(['total', 'amount_paid'])
            ->filter(
                fn (Invoice $invoice) => $invoice->amountDueCents() > 0
            )
            ->count();
    }

    /**
     * Six derniers mois : produits et charges.
     *
     * @return list<array{month:string, revenue:string, expenses:string}>
     */
    private function monthlySeries(
        int $companyId,
        CarbonImmutable $today
    ): array {
        $start = $today->startOfMonth()->subMonths(5);

        $rows = DB::table('journal_entry_lines as l')
            ->join(
                'journal_entries as e',
                'e.id',
                '=',
                'l.journal_entry_id'
            )
            ->join(
                'accounts as a',
                'a.id',
                '=',
                'l.account_id'
            )
            ->where('e.company_id', $companyId)
            ->where('a.company_id', $companyId)
            ->whereIn('e.status', [
                JournalEntry::STATUS_POSTED,
                JournalEntry::STATUS_REVERSED,
            ])
            ->whereIn('a.type', ['income', 'expense'])
            ->whereDate('e.entry_date', '>=', $start->toDateString())
            ->whereDate('e.entry_date', '<=', $today->toDateString())
            ->groupBy('e.entry_date', 'a.type')
            ->selectRaw(
                'e.entry_date as day,
                 a.type,
                 SUM(l.debit) as debit,
                 SUM(l.credit) as credit'
            )
            ->get();

        $series = [];

        for ($i = 0; $i < 6; $i++) {
            $series[$start->addMonths($i)->format('Y-m')] = [
                'revenue' => 0,
                'expenses' => 0,
            ];
        }

        foreach ($rows as $row) {
            $key = CarbonImmutable::parse($row->day)->format('Y-m');

            if (! isset($series[$key])) {
                continue;
            }

            $debit = Money::toCents($row->debit);
            $credit = Money::toCents($row->credit);

            if ($row->type === 'income') {
                $series[$key]['revenue'] += $credit - $debit;
            } else {
                $series[$key]['expenses'] += $debit - $credit;
            }
        }

        return collect($series)
            ->map(fn (array $values, string $month) => [
                'month' => $month,
                'revenue' => Money::fromCents($values['revenue']),
                'expenses' => Money::fromCents($values['expenses']),
            ])
            ->values()
            ->all();
    }
}
