<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\JournalEntryLine;
use App\Models\Payment;

class PaymentTest extends FeatureTestCase
{
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = $this->makeCompany();
        $this->signIn('finance-manager', $this->company);
    }

    /** Facture de 220,00 validée. */
    private function postedInvoice(string $type = 'customer'): int
    {
        $partner = $this->makePartner($this->company, $type);
        $id = $this->postJson('/api/v1/invoices', [
            'type' => $type, 'partner_id' => $partner->id,
            'invoice_date' => now()->toDateString(), 'due_date' => now()->addDays(30)->toDateString(),
            'lines' => [['account_id' => $this->accountId($this->company, $type === 'customer' ? '706' : '606'), 'description' => 'Service', 'quantity' => '2', 'unit_price' => '100.00', 'tax_rate' => '10']],
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/invoices/$id/post")->assertOk();

        return $id;
    }

    private function pay(int $invoiceId, string $amount, string $key = 'cle-paiement-0001', array $override = [])
    {
        return $this->withHeaders(['Idempotency-Key' => $key])->postJson("/api/v1/invoices/$invoiceId/payments", array_replace([
            'amount' => $amount, 'paid_on' => now()->toDateString(), 'method' => 'bank_transfer',
            'treasury_account_id' => $this->accountId($this->company, '512'),
        ], $override));
    }

    public function test_partial_then_full_payment_settles_the_invoice(): void
    {
        $id = $this->postedInvoice();

        $this->pay($id, '100.00', 'cle-paiement-0001')->assertCreated();
        $this->getJson("/api/v1/invoices/$id")->assertJsonPath('data.status', 'posted')->assertJsonPath('data.amount_paid', '100.00')->assertJsonPath('data.amount_due', '120.00');

        $this->pay($id, '120.00', 'cle-paiement-0002')->assertCreated();
        $this->getJson("/api/v1/invoices/$id")->assertJsonPath('data.status', 'paid')->assertJsonPath('data.amount_due', '0.00');
        $this->getJson('/api/v1/reports/treasury')->assertJsonPath('data.total', '220.00');
    }

    public function test_customer_payment_debits_treasury_and_credits_receivable(): void
    {
        $id = $this->postedInvoice();
        $entryId = $this->pay($id, '50.00')->assertCreated()->json('data.journal_entry_id');

        $lines = JournalEntryLine::query()->where('journal_entry_id', $entryId)->get()->keyBy('account_id');
        $this->assertSame('50.00', $lines[$this->accountId($this->company, '512')]->debit);
        $this->assertSame('50.00', $lines[$this->accountId($this->company, '411')]->credit);
    }

    public function test_supplier_payment_debits_payable_and_credits_treasury(): void
    {
        $id = $this->postedInvoice('supplier');
        $entryId = $this->pay($id, '70.00')->assertCreated()->json('data.journal_entry_id');

        $lines = JournalEntryLine::query()->where('journal_entry_id', $entryId)->get()->keyBy('account_id');
        $this->assertSame('70.00', $lines[$this->accountId($this->company, '401')]->debit);
        $this->assertSame('70.00', $lines[$this->accountId($this->company, '512')]->credit);
    }

    public function test_overpayment_is_refused(): void
    {
        $id = $this->postedInvoice();

        $this->pay($id, '220.01')->assertStatus(422)->assertJsonPath('code', 'payment_exceeds_due');
        $this->assertSame(0, Payment::query()->count());
    }

    public function test_replaying_the_same_request_never_creates_a_second_payment(): void
    {
        $id = $this->postedInvoice();

        $first = $this->pay($id, '100.00', 'cle-rejouee-01')->assertCreated();
        $second = $this->pay($id, '100.00', 'cle-rejouee-01')->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, Payment::query()->count());
        $this->assertSame('100.00', Invoice::query()->find($id)->amount_paid);
    }

    public function test_an_idempotency_key_cannot_be_reused_for_another_invoice(): void
    {
        $a = $this->postedInvoice();
        $b = $this->postedInvoice();

        $this->pay($a, '10.00', 'cle-partagee-01')->assertCreated();
        $this->pay($b, '10.00', 'cle-partagee-01')->assertStatus(422)->assertJsonPath('code', 'idempotency_conflict');
    }

    public function test_idempotency_key_is_mandatory(): void
    {
        $id = $this->postedInvoice();

        $this->postJson("/api/v1/invoices/$id/payments", [
            'amount' => '10.00', 'paid_on' => now()->toDateString(), 'method' => 'cash', 'treasury_account_id' => $this->accountId($this->company, '530'),
        ])->assertStatus(422)->assertJsonValidationErrors('idempotency_key');
    }

    public function test_payment_requires_a_posted_invoice_and_a_treasury_account(): void
    {
        $draft = $this->postJson('/api/v1/invoices', [
            'type' => 'customer', 'partner_id' => $this->makePartner($this->company)->id,
            'invoice_date' => now()->toDateString(), 'due_date' => now()->toDateString(),
            'lines' => [['account_id' => $this->accountId($this->company, '706'), 'description' => 'X', 'quantity' => 1, 'unit_price' => '10.00']],
        ])->json('data.id');
        $this->pay($draft, '5.00', 'cle-brouillon-01')->assertStatus(422)->assertJsonPath('code', 'invoice_not_payable');

        $id = $this->postedInvoice();
        $this->pay($id, '5.00', 'cle-compte-0001', ['treasury_account_id' => $this->accountId($this->company, '706')])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_treasury_account');
    }

    public function test_cash_payments_use_the_cash_journal(): void
    {
        $id = $this->postedInvoice();

        $this->pay($id, '30.00', 'cle-caisse-0001', ['method' => 'cash', 'treasury_account_id' => $this->accountId($this->company, '530')])->assertCreated();

        $entry = \App\Models\JournalEntry::query()->where('source_type', 'payment')->firstOrFail();
        $this->assertSame($this->journalId($this->company, 'CSH'), $entry->journal_id);
    }

    public function test_an_invoice_with_payments_cannot_be_cancelled(): void
    {
        $id = $this->postedInvoice();
        $this->pay($id, '10.00')->assertCreated();

        $this->postJson("/api/v1/invoices/$id/cancel")->assertStatus(422)->assertJsonPath('code', 'invoice_has_payments');
    }

    public function test_a_paid_invoice_accepts_no_more_payments(): void
    {
        $id = $this->postedInvoice();
        $this->pay($id, '220.00', 'cle-solde-0001')->assertCreated();

        $this->pay($id, '1.00', 'cle-solde-0002')->assertStatus(422)->assertJsonPath('code', 'invoice_not_payable');
    }

    public function test_payments_are_listed_and_filterable(): void
    {
        $a = $this->postedInvoice();
        $b = $this->postedInvoice();
        $this->pay($a, '10.00', 'cle-liste-00001')->assertCreated();
        $this->pay($b, '20.00', 'cle-liste-00002')->assertCreated();

        $this->getJson('/api/v1/payments')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson("/api/v1/payments?invoice_id=$a")->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.amount', '10.00');
    }
}
