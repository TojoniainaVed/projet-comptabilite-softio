<?php

namespace Tests\Feature;

use App\Models\Account;
use Laravel\Sanctum\Sanctum;

class CompanyIsolationTest extends FeatureTestCase
{
    public function test_another_companys_records_are_invisible_not_merely_forbidden(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();

        $this->signIn('finance-manager', $companyA);
        $entryId = $this->postJson('/api/v1/journal-entries', $this->entryPayload($companyA, '500.00'))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$entryId/post")->assertOk();
        $customer = $this->makePartner($companyA);
        $invoiceId = $this->postJson('/api/v1/invoices', [
            'type' => 'customer', 'partner_id' => $customer->id, 'invoice_date' => now()->toDateString(), 'due_date' => now()->toDateString(),
            'lines' => [['account_id' => $this->accountId($companyA, '706'), 'description' => 'X', 'quantity' => 1, 'unit_price' => '10.00']],
        ])->assertCreated()->json('data.id');
        $accountA = $this->accountId($companyA, '512');

        $this->signIn('finance-manager', $companyB);

        $this->getJson("/api/v1/journal-entries/$entryId")->assertNotFound();
        $this->postJson("/api/v1/journal-entries/$entryId/post")->assertNotFound();
        $this->postJson("/api/v1/journal-entries/$entryId/reverse")->assertNotFound();
        $this->getJson("/api/v1/invoices/$invoiceId")->assertNotFound();
        $this->postJson("/api/v1/invoices/$invoiceId/post")->assertNotFound();
        $this->getJson("/api/v1/accounts/$accountA")->assertNotFound();
        $this->putJson("/api/v1/accounts/$accountA", ['code' => '512', 'name' => 'Piraté', 'type' => 'asset'])->assertNotFound();
        $this->getJson("/api/v1/customers/{$customer->id}")->assertNotFound();

        $this->getJson('/api/v1/journal-entries')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/invoices')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/customers')->assertOk()->assertJsonCount(0, 'data');
        $this->assertNotSame('Piraté', Account::withoutGlobalScopes()->find($accountA)->name);
    }

    public function test_foreign_references_in_payloads_are_rejected(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();
        $foreignCustomer = $this->makePartner($companyA);

        $this->signIn('finance-manager', $companyB);

        $payload = $this->entryPayload($companyB);
        $payload['lines'][0]['account_id'] = $this->accountId($companyA, '512');
        $this->postJson('/api/v1/journal-entries', $payload)->assertStatus(422)->assertJsonValidationErrors('lines.0.account_id');

        $payload = $this->entryPayload($companyB);
        $payload['journal_id'] = $this->journalId($companyA, 'OD');
        $this->postJson('/api/v1/journal-entries', $payload)->assertStatus(422)->assertJsonValidationErrors('journal_id');

        $this->postJson('/api/v1/invoices', [
            'type' => 'customer', 'partner_id' => $foreignCustomer->id, 'invoice_date' => now()->toDateString(), 'due_date' => now()->toDateString(),
            'lines' => [['account_id' => $this->accountId($companyB, '706'), 'description' => 'X', 'quantity' => 1, 'unit_price' => '10.00']],
        ])->assertStatus(422)->assertJsonValidationErrors('partner_id');
    }

    public function test_reports_and_dashboard_only_aggregate_the_callers_company(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();

        $this->signIn('finance-manager', $companyA);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($companyA, '800.00'))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();
        $this->getJson('/api/v1/reports/trial-balance')->assertJsonPath('data.totals.debit', '800.00');
        $this->getJson('/api/v1/reports/treasury')->assertJsonPath('data.total', '800.00');

        Sanctum::actingAs($this->makeUser('finance-manager', $companyB), ['*']);
        $this->getJson('/api/v1/reports/trial-balance')->assertJsonPath('data.totals.debit', '0.00')->assertJsonCount(0, 'data.rows');
        $this->getJson('/api/v1/reports/treasury')->assertJsonPath('data.total', '0.00');
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('data.treasury_total', '0.00');
    }

    public function test_the_same_account_code_can_exist_in_two_companies(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();

        $this->signIn('company-admin', $companyA);
        $this->postJson('/api/v1/accounts', ['code' => '512', 'name' => 'Doublon', 'type' => 'asset'])->assertStatus(422)->assertJsonValidationErrors('code');
        $this->postJson('/api/v1/accounts', ['code' => '999', 'name' => 'Spécifique A', 'type' => 'expense'])->assertCreated();

        $this->signIn('company-admin', $companyB);
        $this->postJson('/api/v1/accounts', ['code' => '999', 'name' => 'Spécifique B', 'type' => 'expense'])->assertCreated();
    }

    public function test_global_scope_hides_other_companies_even_in_direct_queries(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();

        $this->signIn('accountant', $companyA);

        $this->assertSame(0, Account::query()->where('company_id', $companyB->id)->count());
        $this->assertGreaterThan(0, Account::query()->count());
        $this->assertGreaterThan(Account::query()->count(), Account::withoutGlobalScopes()->count());
    }
}
