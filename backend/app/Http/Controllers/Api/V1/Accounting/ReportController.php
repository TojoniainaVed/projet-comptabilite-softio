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

    public function incomeStatement(Request $request): JsonResponse|StreamedResponse
    {
        $this->authorize('reports.view');
        [$from, $to] = $this->period($request);

        $report = $this->reports->incomeStatement($request->user()->company_id, $from, $to);

        if ($request->query('format') === 'csv') {
            return $this->csv('income_statement', 'compte-de-resultat.csv', ['Section', 'Compte', 'Intitulé', 'Montant'], function ($out) use ($report): void {
                foreach ($report['income'] as $l) {
                    fputcsv($out, ['Produits', $l['code'], $l['name'], $l['amount']], ';');
                }
                fputcsv($out, ['Produits', '', 'Total produits', $report['total_income']], ';');
                foreach ($report['expenses'] as $l) {
                    fputcsv($out, ['Charges', $l['code'], $l['name'], $l['amount']], ';');
                }
                fputcsv($out, ['Charges', '', 'Total charges', $report['total_expenses']], ';');
                fputcsv($out, ['Résultat', '', 'Résultat net', $report['net_result']], ';');
            });
        }

        return response()->json(['data' => $report]);
    }

    public function balanceSheet(Request $request): JsonResponse|StreamedResponse
    {
        $this->authorize('reports.view');
        $data = $request->validate(['as_of' => ['nullable', 'date']]);

        $report = $this->reports->balanceSheet(
            $request->user()->company_id,
            $data['as_of'] ?? now()->toDateString(),
        );

        if ($request->query('format') === 'csv') {
            return $this->csv('balance_sheet', 'bilan-simplifie.csv', ['Section', 'Compte', 'Intitulé', 'Montant'], function ($out) use ($report): void {
                foreach (['assets' => 'Actif', 'liabilities' => 'Passif', 'equity' => 'Capitaux propres'] as $key => $label) {
                    foreach ($report[$key] as $l) {
                        fputcsv($out, [$label, $l['code'], $l['name'], $l['amount']], ';');
                    }
                }
                fputcsv($out, ['Capitaux propres', '', 'Résultat non clôturé', $report['unclosed_result']], ';');
                fputcsv($out, ['Total', '', 'Total actif', $report['total_assets']], ';');
                fputcsv($out, ['Total', '', 'Total passif + capitaux propres', $report['total_liabilities_and_equity']], ';');
            });
        }

        return response()->json(['data' => $report]);
    }

    public function generalLedger(Request $request): JsonResponse|StreamedResponse
    {
        $this->authorize('reports.view');
        [$from, $to] = $this->period($request);
        $data = $request->validate(['account_id' => ['required', 'integer']]);

        $report = $this->reports->generalLedger($request->user()->company_id, (int) $data['account_id'], $from, $to);
        abort_if($report === null, 404, 'Compte introuvable.');

        if ($request->query('format') === 'csv') {
            return $this->csv('general_ledger', 'grand-livre-'.$report['account']['code'].'.csv', ['Date', 'Pièce', 'Libellé', 'Débit', 'Crédit', 'Solde'], function ($out) use ($report): void {
                fputcsv($out, ['', '', 'Solde d\'ouverture', '', '', $report['opening_balance']], ';');
                foreach ($report['lines'] as $l) {
                    fputcsv($out, [$l['date'], $l['reference'], $l['label'], $l['debit'], $l['credit'], $l['balance']], ';');
                }
                fputcsv($out, ['', '', 'Total', $report['totals']['debit'], $report['totals']['credit'], $report['totals']['closing_balance']], ';');
            });
        }

        return response()->json(['data' => $report]);
    }

    public function treasury(Request $request): JsonResponse
    {
        $this->authorize('reports.view');

        return response()->json(['data' => $this->reports->treasury($request->user()->company_id)]);
    }

    /** Export CSV (UTF-8 avec BOM pour Excel, séparateur « ; ») : droit d'export requis et journalisé. */
    private function csv(string $report, string $filename, array $header, callable $rows): StreamedResponse
    {
        $this->authorize('reports.export');
        $this->audit->log('report.exported', null, ['report' => $report]);

        return response()->streamDownload(function () use ($header, $rows): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header, ';');
            $rows($out);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
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
