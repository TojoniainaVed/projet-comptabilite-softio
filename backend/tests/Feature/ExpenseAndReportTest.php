<?php

namespace Tests\Feature;

use App\Models\JournalEntryLine;

class ExpenseAndReportTest extends FeatureTestCase
{
    private function expense(\App\Models\Company $company, array $override = []): array
    {
        return array_replace([
            'expense_date' => now()->toDateString(), 'description' => 'Loyer du mois', 'amount' => '300.00',
            'account_id' => $this->accountId($company, '613'), 'paid_from_account_id' => $this->accountId($company, '512'),
        ], $override);
    }

    public function test_expense_is_posted_as_debit_expense_credit_treasury(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);

        $id = $this->postJson('/api/v1/expenses', $this->expense($company))->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');
        $entryId = $this->postJson("/api/v1/expenses/$id/post")->assertOk()->assertJsonPath('data.status', 'posted')->json('data.journal_entry_id');

        $lines = JournalEntryLine::query()->where('journal_entry_id', $entryId)->get()->keyBy('account_id');
        $this->assertSame('300.00', $lines[$this->accountId($company, '613')]->debit);
        $this->assertSame('300.00', $lines[$this->accountId($company, '512')]->credit);
        $this->assertDatabaseHas('audit_logs', ['action' => 'expense.posted']);
    }

    public function test_posted_expense_is_frozen_and_invalid_accounts_are_refused(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);

        $this->postJson('/api/v1/expenses', $this->expense($company, ['account_id' => $this->accountId($company, '706')]))
            ->assertStatus(422)->assertJsonPath('code', 'invalid_expense_account');
        $this->postJson('/api/v1/expenses', $this->expense($company, ['amount' => '0']))->assertStatus(422)->assertJsonValidationErrors('amount');

        $id = $this->postJson('/api/v1/expenses', $this->expense($company))->json('data.id');
        $this->postJson("/api/v1/expenses/$id/post")->assertOk();

        $this->putJson("/api/v1/expenses/$id", $this->expense($company))->assertStatus(422)->assertJsonPath('code', 'expense_not_draft');
        $this->deleteJson("/api/v1/expenses/$id")->assertStatus(422)->assertJsonPath('code', 'expense_not_draft');
        $this->postJson("/api/v1/expenses/$id/post")->assertStatus(422)->assertJsonPath('code', 'expense_not_draft');
    }

    public function test_auditor_cannot_record_expenses(): void
    {
        $company = $this->makeCompany();
        $this->signIn('auditor', $company);

        $this->postJson('/api/v1/expenses', $this->expense($company))->assertForbidden();
        $this->getJson('/api/v1/expenses')->assertOk();
    }

    public function test_financial_statements_are_computed_from_posted_entries_only(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);

        // Capital 1000 → banque ; vente 200 (TVA 40) ; dépense 300 payée par la banque.
        $capital = $this->postJson('/api/v1/journal-entries', [
            'journal_id' => $this->journalId($company, 'OD'), 'entry_date' => now()->toDateString(), 'description' => 'Apport en capital',
            'lines' => [
                ['account_id' => $this->accountId($company, '512'), 'debit' => '1000.00', 'credit' => 0],
                ['account_id' => $this->accountId($company, '101'), 'debit' => 0, 'credit' => '1000.00'],
            ],
        ])->json('data.id');
        $this->postJson("/api/v1/journal-entries/$capital/post")->assertOk();

        $invoice = $this->postJson('/api/v1/invoices', [
            'type' => 'customer', 'partner_id' => $this->makePartner($company)->id,
            'invoice_date' => now()->toDateString(), 'due_date' => now()->toDateString(),
            'lines' => [['account_id' => $this->accountId($company, '706'), 'description' => 'Conseil', 'quantity' => '1', 'unit_price' => '200.00', 'tax_rate' => '20']],
        ])->json('data.id');
        $this->postJson("/api/v1/invoices/$invoice/post")->assertOk();

        $expense = $this->postJson('/api/v1/expenses', $this->expense($company))->json('data.id');
        $this->postJson("/api/v1/expenses/$expense/post")->assertOk();

        // Un brouillon ne doit jamais apparaître dans les rapports.
        $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, '9999.00'));

        $this->getJson('/api/v1/reports/trial-balance')->assertOk()
            ->assertJsonPath('data.totals.debit', '1540.00')
            ->assertJsonPath('data.totals.credit', '1540.00')
            ->assertJsonPath('data.totals.balanced', 'true');

        $this->getJson('/api/v1/reports/income-statement')->assertOk()
            ->assertJsonPath('data.total_income', '200.00')
            ->assertJsonPath('data.total_expenses', '300.00')
            ->assertJsonPath('data.net_result', '-100.00');

        $balanceSheet = $this->getJson('/api/v1/reports/balance-sheet')->assertOk();
        $balanceSheet->assertJsonPath('data.balanced', true)
            ->assertJsonPath('data.total_assets', '940.00')                 // banque 700 + clients 240
            ->assertJsonPath('data.total_liabilities', '40.00')             // TVA collectée
            ->assertJsonPath('data.unclosed_result', '-100.00')
            ->assertJsonPath('data.total_equity', '900.00');                // capital 1000 − résultat 100

        $this->getJson('/api/v1/reports/treasury')->assertOk()->assertJsonPath('data.total', '700.00');

        $this->getJson('/api/v1/dashboard')->assertOk()
            ->assertJsonPath('data.treasury_total', '700.00')
            ->assertJsonPath('data.receivable_outstanding', '240.00')
            ->assertJsonPath('data.draft_entries', 1)
            ->assertJsonCount(6, 'data.monthly');
    }

    public function test_period_filter_and_csv_export(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, '40.00'))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();

        $this->getJson('/api/v1/reports/trial-balance?from=2000-01-01&to=2000-12-31')->assertJsonPath('data.totals.debit', '0.00');
        $this->getJson('/api/v1/reports/trial-balance?from=2026-12-31&to=2026-01-01')->assertStatus(422)->assertJsonValidationErrors('to');

        $csv = $this->get('/api/v1/reports/trial-balance?format=csv')->assertOk()->streamedContent();
        $this->assertStringContainsString('512', $csv);
        $this->assertStringContainsString('40.00', $csv);
        $this->assertDatabaseHas('audit_logs', ['action' => 'report.exported']);
    }
}
