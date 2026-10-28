<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Services\Accounting\ReportService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly AuditLogger $audit,
    ) {}

    public function trialBalance(Request $request): JsonResponse|StreamedResponse
    {
        $this->authorize('reports.view');
        [$from, $to] = $this->period($request);

        $report = $this->reports->trialBalance($request->user()->company_id, $from, $to);

        if ($request->query('format') === 'csv') {
            $this->authorize('reports.export');
            $this->audit->log('report.exported', null, ['report' => 'trial_balance']);

            return response()->streamDownload(function () use ($report): void {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF");
                fputcsv($out, ['Compte', 'Intitulé', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur'], ';');
                foreach ($report['rows'] as $row) {
                    fputcsv($out, [$row['code'], $row['name'], $row['debit'], $row['credit'], $row['balance_debit'], $row['balance_credit']], ';');
                }
                fputcsv($out, ['', 'Total', $report['totals']['debit'], $report['totals']['credit'], '', ''], ';');
                fclose($out);
            }, 'balance-generale.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return response()->json(['data' => $report]);
    }

    public function incomeStatement(Request $request): JsonResponse
    {
        $this->authorize('reports.view');
        [$from, $to] = $this->period($request);

        return response()->json(['data' => $this->reports->incomeStatement($request->user()->company_id, $from, $to)]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $this->authorize('reports.view');
        $data = $request->validate(['as_of' => ['nullable', 'date']]);

        return response()->json(['data' => $this->reports->balanceSheet(
            $request->user()->company_id,
            $data['as_of'] ?? now()->toDateString(),
        )]);
    }

    public function treasury(Request $request): JsonResponse
    {
        $this->authorize('reports.view');

        return response()->json(['data' => $this->reports->treasury($request->user()->company_id)]);
    }

    /** @return array{0: ?string, 1: ?string} */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return [$data['from'] ?? null, $data['to'] ?? null];
    }
}
