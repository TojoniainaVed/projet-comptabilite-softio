<?php

namespace Tests\Feature;

use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use LogicException;

class JournalEntryTest extends FeatureTestCase
{
    public function test_balanced_entry_is_posted_with_sequential_references(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);

        $first = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');
        $second = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, '50.00'))->assertCreated()->json('data.id');

        $this->postJson("/api/v1/journal-entries/$first/post")->assertOk()->assertJsonPath('data.status', 'posted')->assertJsonPath('data.reference', 'OD-000001');
        $this->postJson("/api/v1/journal-entries/$second/post")->assertOk()->assertJsonPath('data.reference', 'OD-000002');
        $this->assertDatabaseHas('audit_logs', ['action' => 'journal_entry.posted', 'subject_id' => $first]);
    }

    public function test_unbalanced_entry_is_never_posted(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $payload = $this->entryPayload($company);
        $payload['lines'][1]['credit'] = '99.99';

        $id = $this->postJson('/api/v1/journal-entries', $payload)->assertCreated()->json('data.id');

        $this->postJson("/api/v1/journal-entries/$id/post")->assertStatus(422)->assertJsonPath('code', 'entry_unbalanced');

        $entry = JournalEntry::withoutGlobalScopes()->find($id);
        $this->assertSame('draft', $entry->status);
        $this->assertNull($entry->reference);
    }

    public function test_entry_needs_two_lines_and_valid_amounts(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);

        $oneLine = $this->entryPayload($company);
        $oneLine['lines'] = [$oneLine['lines'][0]];
        $this->postJson('/api/v1/journal-entries', $oneLine)->assertStatus(422)->assertJsonValidationErrors('lines');

        $threeDecimals = $this->entryPayload($company, '10.005');
        $this->postJson('/api/v1/journal-entries', $threeDecimals)->assertStatus(422)->assertJsonValidationErrors('lines.0.debit');

        $negative = $this->entryPayload($company, '-5');
        $this->postJson('/api/v1/journal-entries', $negative)->assertStatus(422);

        $both = $this->entryPayload($company);
        $both['lines'][0]['credit'] = '10.00';
        $this->postJson('/api/v1/journal-entries', $both)->assertStatus(422)->assertJsonPath('code', 'invalid_line_amount');
    }

    public function test_posted_entry_cannot_be_modified_or_deleted(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();

        $this->putJson("/api/v1/journal-entries/$id", $this->entryPayload($company, '999.00'))->assertStatus(422)->assertJsonPath('code', 'entry_not_draft');
        $this->deleteJson("/api/v1/journal-entries/$id")->assertStatus(422)->assertJsonPath('code', 'entry_not_draft');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertStatus(422)->assertJsonPath('code', 'entry_not_draft');
    }

    public function test_posted_entries_are_immutable_even_through_the_models(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();

        $entry = JournalEntry::withoutGlobalScopes()->find($id);

        try {
            $entry->update(['description' => 'Falsifiée']);
            $this->fail("L'écriture validée aurait dû être protégée.");
        } catch (LogicException) {
            $this->assertNotSame('Falsifiée', $entry->fresh()->description);
        }

        $line = JournalEntryLine::query()->where('journal_entry_id', $id)->first();
        $this->expectException(LogicException::class);
        $line->update(['debit' => '1.00']);
    }

    public function test_draft_can_be_edited_and_deleted(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');

        $this->putJson("/api/v1/journal-entries/$id", $this->entryPayload($company, '250.00'))
            ->assertOk()->assertJsonPath('data.lines.0.debit', '250.00');
        $this->deleteJson("/api/v1/journal-entries/$id")->assertNoContent();
        $this->assertDatabaseMissing('journal_entries', ['id' => $id]);
    }

    public function test_reversal_creates_a_mirror_entry_and_nets_to_zero(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, '120.00'))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();

        $reversal = $this->postJson("/api/v1/journal-entries/$id/reverse", ['reason' => 'Erreur de saisie'])
            ->assertOk()->assertJsonPath('data.status', 'posted')->assertJsonPath('data.reversal_of_id', $id);
        $this->assertSame('120.00', $reversal->json('data.lines.0.credit')); // débit/crédit inversés

        $this->assertSame('reversed', JournalEntry::withoutGlobalScopes()->find($id)->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'journal_entry.reversed', 'subject_id' => $id]);

        $report = $this->getJson('/api/v1/reports/trial-balance')->assertOk();
        $this->assertSame('240.00', $report->json('data.totals.debit'));
        foreach ($report->json('data.rows') as $row) {
            $this->assertSame('0.00', $row['balance_debit']);
            $this->assertSame('0.00', $row['balance_credit']);
        }
    }

    public function test_an_entry_cannot_be_reversed_twice_nor_a_reversal_reversed(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertOk();
        $reversalId = $this->postJson("/api/v1/journal-entries/$id/reverse")->assertOk()->json('data.id');

        $this->postJson("/api/v1/journal-entries/$id/reverse")->assertStatus(422)->assertJsonPath('code', 'entry_not_reversible');
        $this->postJson("/api/v1/journal-entries/$reversalId/reverse")->assertStatus(422)->assertJsonPath('code', 'entry_not_reversible');
    }

    public function test_draft_cannot_be_reversed(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');

        $this->postJson("/api/v1/journal-entries/$id/reverse")->assertStatus(422)->assertJsonPath('code', 'entry_not_reversible');
    }

    public function test_posting_requires_an_open_fiscal_year(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $payload = $this->entryPayload($company);
        $payload['entry_date'] = '2000-01-15';
        $id = $this->postJson('/api/v1/journal-entries', $payload)->assertCreated()->json('data.id');

        $this->postJson("/api/v1/journal-entries/$id/post")->assertStatus(422)->assertJsonPath('code', 'no_open_fiscal_year');
    }

    public function test_closed_fiscal_year_blocks_posting(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $year = $this->getJson('/api/v1/fiscal-years')->assertOk()->json('data.0');
        $this->putJson("/api/v1/fiscal-years/{$year['id']}", [
            'name' => $year['name'], 'starts_on' => $year['starts_on'], 'ends_on' => $year['ends_on'], 'status' => 'closed',
        ])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'fiscal_year.closed']);

        $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$id/post")->assertStatus(422)->assertJsonPath('code', 'no_open_fiscal_year');
    }

    public function test_overlapping_fiscal_years_are_rejected(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $year = now()->year;

        $this->postJson('/api/v1/fiscal-years', ['name' => 'Chevauchement', 'starts_on' => "$year-06-01", 'ends_on' => ($year + 1).'-05-31'])
            ->assertStatus(422)->assertJsonValidationErrors('starts_on');
        $this->postJson('/api/v1/fiscal-years', ['name' => (string) ($year + 1), 'starts_on' => ($year + 1).'-01-01', 'ends_on' => ($year + 1).'-12-31'])->assertCreated();
    }

    public function test_export_is_limited_to_posted_entries(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        $posted = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company))->json('data.id');
        $this->postJson("/api/v1/journal-entries/$posted/post")->assertOk();
        $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, '77.00'))->assertCreated();

        $csv = $this->get('/api/v1/journal-entries/export')->assertOk()->streamedContent();

        $this->assertStringContainsString('OD-000001', $csv);
        $this->assertStringNotContainsString('77.00', $csv);
    }

    public function test_filters_and_pagination(): void
    {
        $company = $this->makeCompany();
        $this->signIn('finance-manager', $company);
        foreach (['10.00', '20.00', '30.00'] as $amount) {
            $id = $this->postJson('/api/v1/journal-entries', $this->entryPayload($company, $amount))->json('data.id');
            $this->postJson("/api/v1/journal-entries/$id/post");
        }
        $this->postJson('/api/v1/journal-entries', $this->entryPayload($company));

        $this->getJson('/api/v1/journal-entries?status=posted&per_page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 3);
        $this->getJson('/api/v1/journal-entries?status=draft')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/journal-entries?search=OD-000002')->assertOk()->assertJsonPath('meta.total', 1);
    }
}
