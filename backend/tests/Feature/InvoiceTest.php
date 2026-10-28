<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\InvoiceLine;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\Partner;
use App\Services\Accounting\EntryBalance;
use LogicException;

class InvoiceTest extends FeatureTestCase
{
    /** 2 × 50,00 (TVA 20 %) + 1 × 100,00 (sans TVA) : HT 200,00 — TVA 20,00 — TTC 220,00 */
    private function payload(Company $company, Partner $partner, array $override = []): array
    {
        return array_replace([
            'type' => $partner->type,
            'partner_id' => $partner->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'lines' => [
                ['account_id' => $this->accountId($company, $partner->type === 'customer' ? '706' : '606'), 'description' => 'Prestation', 'quantity' => '2', 'unit_price' => '50.00', 'tax_rate' => '20'],
                ['account_id' => $this->accountId($company, $partner->type === 'customer' ? '701' : '601'), 'description' => 'Marchandise', 'quantity' => '1', 'unit_price' => '100.00', 'tax_rate' => '0'],
            ],
        ], $override);
    }

    private function lineAmounts(int $entryId, Company $company): array
    {
        $lines = JournalEntryLine::query()->where('journal_entry_id', $entryId)->get();

        return $lines->mapWithKeys(fn ($l) => [$l->account_id => [$l->debit, $l->credit]])->all();
    }

    public function test_totals_are_computed_by_the_server_never_trusted_from_the_client(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);

        $this->postJson('/api/v1/invoices', $this->payload($company, $customer) + ['total' => '1.00', 'subtotal' => '1.00', 'status' => 'paid', 'amount_paid' => '220.00'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.subtotal', '200.00')
            ->assertJsonPath('data.tax_total', '20.00')
            ->assertJsonPath('data.total', '220.00')
            ->assertJsonPath('data.amount_paid', '0.00')
            ->assertJsonPath('data.lines.0.net_amount', '100.00')
            ->assertJsonPath('data.lines.0.tax_amount', '20.00');
    }

    public function test_posting_a_customer_invoice_generates_a_balanced_entry(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');

        $response = $this->postJson("/api/v1/invoices/$id/post")->assertOk()->assertJsonPath('data.status', 'posted')->assertJsonPath('data.number', 'VEN-000001');

        $entryId = $response->json('data.journal_entry_id');
        $entry = JournalEntry::query()->findOrFail($entryId);
        $this->assertSame('posted', $entry->status);
        $this->assertSame('invoice', $entry->source_type);

        $amounts = $this->lineAmounts($entryId, $company);
        $this->assertSame('220.00', $amounts[$this->accountId($company, '411')][0]);   // client débité TTC
        $this->assertSame('100.00', $amounts[$this->accountId($company, '706')][1]);   // produits crédités HT
        $this->assertSame('100.00', $amounts[$this->accountId($company, '701')][1]);
        $this->assertSame('20.00', $amounts[$this->accountId($company, '4457')][1]);   // TVA collectée
        $this->assertTrue(EntryBalance::isBalanced(EntryBalance::totals(JournalEntryLine::query()->where('journal_entry_id', $entryId)->get())));
    }

    public function test_posting_a_supplier_invoice_credits_the_supplier_account(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $supplier = $this->makePartner($company, 'supplier');
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $supplier, ['supplier_reference' => 'F-2026-001']))->json('data.id');

        $entryId = $this->postJson("/api/v1/invoices/$id/post")->assertOk()->assertJsonPath('data.number', 'ACH-000001')->json('data.journal_entry_id');

        $amounts = $this->lineAmounts($entryId, $company);
        $this->assertSame('220.00', $amounts[$this->accountId($company, '401')][1]);   // fournisseur crédité TTC
        $this->assertSame('20.00', $amounts[$this->accountId($company, '4456')][0]);   // TVA déductible
        $this->assertSame('100.00', $amounts[$this->accountId($company, '606')][0]);
    }

    public function test_posted_invoice_is_frozen(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');
        $this->postJson("/api/v1/invoices/$id/post")->assertOk();

        $update = $this->payload($company, $customer);
        unset($update['type']);
        $this->putJson("/api/v1/invoices/$id", $update)->assertStatus(422)->assertJsonPath('code', 'invoice_not_draft');
        $this->deleteJson("/api/v1/invoices/$id")->assertStatus(422)->assertJsonPath('code', 'invoice_not_draft');
        $this->postJson("/api/v1/invoices/$id/post")->assertStatus(422)->assertJsonPath('code', 'invoice_not_draft');

        $this->expectException(LogicException::class);
        InvoiceLine::query()->where('invoice_id', $id)->first()->update(['unit_price' => '1.00']);
    }

    public function test_draft_can_be_edited_with_totals_recomputed_then_deleted(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');

        $update = $this->payload($company, $customer);
        unset($update['type']);
        $update['lines'] = [['account_id' => $this->accountId($company, '706'), 'description' => 'Une seule ligne', 'quantity' => '3', 'unit_price' => '10.00', 'tax_rate' => '10']];

        $this->putJson("/api/v1/invoices/$id", $update)->assertOk()->assertJsonPath('data.total', '33.00')->assertJsonCount(1, 'data.lines');
        $this->deleteJson("/api/v1/invoices/$id")->assertNoContent();
    }

    public function test_partner_must_match_the_invoice_type(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $supplier = $this->makePartner($company, 'supplier');

        $this->postJson('/api/v1/invoices', $this->payload($company, $supplier, ['type' => 'customer']))
            ->assertStatus(422)->assertJsonPath('code', 'invalid_partner');
    }

    public function test_invoice_validation(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);

        $this->postJson('/api/v1/invoices', $this->payload($company, $customer, ['lines' => []]))->assertStatus(422)->assertJsonValidationErrors('lines');
        $this->postJson('/api/v1/invoices', $this->payload($company, $customer, ['due_date' => now()->subDay()->toDateString()]))->assertStatus(422)->assertJsonValidationErrors('due_date');

        $bad = $this->payload($company, $customer);
        $bad['lines'][0]['quantity'] = '0';
        $bad['lines'][0]['tax_rate'] = '150';
        $this->postJson('/api/v1/invoices', $bad)->assertStatus(422)->assertJsonValidationErrors(['lines.0.quantity', 'lines.0.tax_rate']);
    }

    public function test_cancelling_an_unpaid_invoice_reverses_its_entry(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');
        $entryId = $this->postJson("/api/v1/invoices/$id/post")->json('data.journal_entry_id');

        $this->postJson("/api/v1/invoices/$id/cancel", ['reason' => 'Doublon'])->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertSame('reversed', JournalEntry::query()->find($entryId)->status);
        $this->getJson('/api/v1/reports/trial-balance')->assertJsonPath('data.totals.balanced', 'true');
        $this->getJson('/api/v1/reports/income-statement')->assertJsonPath('data.net_result', '0.00');
    }

    public function test_linked_entries_cannot_be_reversed_directly(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');
        $entryId = $this->postJson("/api/v1/invoices/$id/post")->json('data.journal_entry_id');

        $this->postJson("/api/v1/journal-entries/$entryId/reverse")->assertStatus(422)->assertJsonPath('code', 'entry_linked_to_document');
    }

    public function test_missing_accounting_configuration_is_reported_clearly(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        \App\Models\Account::withoutGlobalScopes()->where('company_id', $company->id)->where('category', 'receivable')->update(['is_active' => false]);
        $customer = $this->makePartner($company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->json('data.id');

        $this->postJson("/api/v1/invoices/$id/post")->assertStatus(422)->assertJsonPath('code', 'account_category_missing');
        $this->assertSame('draft', \App\Models\Invoice::withoutGlobalScopes()->find($id)->status);
    }

    public function test_auditor_cannot_create_and_billing_manager_cannot_cancel(): void
    {
        $company = $this->makeCompany();
        $customer = $this->makePartner($company);

        $this->signIn('auditor', $company);
        $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->assertForbidden();

        $this->signIn('billing-manager', $company);
        $id = $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->assertCreated()->json('data.id');
        $this->postJson("/api/v1/invoices/$id/post")->assertOk();
        $this->postJson("/api/v1/invoices/$id/cancel")->assertForbidden();
    }

    public function test_list_filters(): void
    {
        $company = $this->makeCompany();
        $this->signIn('accountant', $company);
        $customer = $this->makePartner($company);
        $supplier = $this->makePartner($company, 'supplier');
        $this->postJson('/api/v1/invoices', $this->payload($company, $customer))->assertCreated();
        $this->postJson('/api/v1/invoices', $this->payload($company, $supplier))->assertCreated();

        $this->getJson('/api/v1/invoices?type=customer')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/invoices?status=draft')->assertJsonPath('meta.total', 2);
        $this->getJson("/api/v1/invoices?partner_id={$supplier->id}")->assertJsonPath('meta.total', 1);
    }
}
