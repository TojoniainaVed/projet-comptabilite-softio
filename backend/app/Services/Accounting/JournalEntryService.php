<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\FiscalYear;
use App\Models\Journal;
use App\Models\JournalEntry;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Cycle de vie d'une écriture : brouillon → validée (partie double vérifiée) → contrepassée.
 */
class JournalEntryService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{journal_id:int, entry_date:string, description:string, lines:list<array{account_id:int, debit?:mixed, credit?:mixed, label?:?string}>}  $data
     */
    public function createDraft(array $data, User $user, ?string $sourceType = null, ?int $sourceId = null): JournalEntry
    {
        return DB::transaction(function () use ($data, $user, $sourceType, $sourceId): JournalEntry {
            $this->assertJournalUsable((int) $data['journal_id']);

            $entry = JournalEntry::create([
                'company_id' => $user->company_id,
                'journal_id' => $data['journal_id'],
                'entry_date' => $data['entry_date'],
                'description' => $data['description'],
                'status' => JournalEntry::STATUS_DRAFT,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'created_by' => $user->id,
            ]);

            $this->replaceLines($entry, $data['lines']);

            return $entry->load('lines.account', 'journal');
        });
    }

    /** @param  array<string, mixed>  $data */
    public function updateDraft(JournalEntry $entry, array $data): JournalEntry
    {
        return DB::transaction(function () use ($entry, $data): JournalEntry {
            if (! $entry->isDraft()) {
                throw new BusinessRuleException('Seule une écriture brouillon peut être modifiée.', 'entry_not_draft');
            }

            $this->assertJournalUsable((int) $data['journal_id']);

            $entry->update([
                'journal_id' => $data['journal_id'],
                'entry_date' => $data['entry_date'],
                'description' => $data['description'],
            ]);
            $this->replaceLines($entry, $data['lines']);

            return $entry->load('lines.account', 'journal');
        });
    }

    public function deleteDraft(JournalEntry $entry): void
    {
        if (! $entry->isDraft()) {
            throw new BusinessRuleException('Seule une écriture brouillon peut être supprimée.', 'entry_not_draft');
        }

        $entry->delete();
    }

    /**
     * Validation : la partie double est vérifiée dans la transaction, sur les lignes verrouillées.
     * Une écriture déséquilibrée n'est JAMAIS validée.
     */
    public function post(JournalEntry $entry, User $user): JournalEntry
    {
        return DB::transaction(function () use ($entry, $user): JournalEntry {
            $locked = JournalEntry::query()->whereKey($entry->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isDraft()) {
                throw new BusinessRuleException('Seule une écriture brouillon peut être validée.', 'entry_not_draft');
            }

            $lines = $locked->lines()->get();
            if ($lines->count() < 2) {
                throw new BusinessRuleException('Une écriture doit comporter au moins deux lignes.', 'entry_too_few_lines');
            }

            $totals = EntryBalance::totals($lines);
            if (! EntryBalance::isBalanced($totals)) {
                throw new BusinessRuleException(
                    sprintf(
                        "Écriture déséquilibrée : débit %s, crédit %s.",
                        Money::fromCents($totals['debit']),
                        Money::fromCents($totals['credit']),
                    ),
                    'entry_unbalanced'
                );
            }

            $date = $locked->entry_date->toDateString();
            $fiscalYear = FiscalYear::query()->open()->covering($date)->first();
            if ($fiscalYear === null) {
                throw new BusinessRuleException("Aucun exercice ouvert ne couvre la date $date.", 'no_open_fiscal_year');
            }

            $journal = Journal::query()->whereKey($locked->journal_id)->lockForUpdate()->firstOrFail();
            $reference = sprintf('%s-%06d', $journal->code, $journal->next_number);
            $journal->increment('next_number');

            $locked->forceFill([
                'status' => JournalEntry::STATUS_POSTED,
                'reference' => $reference,
                'fiscal_year_id' => $fiscalYear->id,
                'posted_at' => now(),
                'posted_by' => $user->id,
            ])->save();

            $this->audit->log('journal_entry.posted', $locked, [
                'reference' => $reference,
                'debit' => Money::fromCents($totals['debit']),
                'credit' => Money::fromCents($totals['credit']),
            ], $user);

            return $locked->load('lines.account', 'journal');
        });
    }

    /**
     * Annulation contrôlée par contrepassation : une écriture miroir validée est créée,
     * l'originale passe à « reversed ». Rien n'est jamais supprimé ni modifié.
     */
    public function reverse(
        JournalEntry $entry,
        User $user,
        ?string $reason = null,
        ?string $date = null,
        bool $fromDocument = false,
    ): JournalEntry {
        return DB::transaction(function () use ($entry, $user, $reason, $date, $fromDocument): JournalEntry {
            $original = JournalEntry::query()->whereKey($entry->getKey())->lockForUpdate()->firstOrFail();

            if (! $original->isPosted() || $original->reversed_at !== null || $original->reversal_of_id !== null) {
                throw new BusinessRuleException('Cette écriture ne peut pas être contrepassée.', 'entry_not_reversible');
            }
            if ($original->source_type !== null && ! $fromDocument) {
                throw new BusinessRuleException(
                    'Cette écriture est liée à un document : annulez le document plutôt que l\'écriture.',
                    'entry_linked_to_document'
                );
            }

            $lines = $original->lines()->get()->map(fn ($line) => [
                'account_id' => $line->account_id,
                'label' => $line->label,
                'debit' => $line->credit,
                'credit' => $line->debit,
            ])->all();

            $reversal = $this->createDraft([
                'journal_id' => $original->journal_id,
                'entry_date' => $date ?? now()->toDateString(),
                'description' => trim("Contrepassation de {$original->reference}".($reason ? " — $reason" : '')),
                'lines' => $lines,
            ], $user, $original->source_type, $original->source_id);

            $reversal->update(['reversal_of_id' => $original->id]);
            $this->post($reversal, $user);

            $original->forceFill([
                'status' => JournalEntry::STATUS_REVERSED,
                'reversed_at' => now(),
            ])->save();

            $this->audit->log('journal_entry.reversed', $original, [
                'reference' => $original->reference,
                'reversal_id' => $reversal->id,
                'reason' => $reason,
            ], $user);

            return $reversal->fresh(['lines.account', 'journal']);
        });
    }

    /** @param  list<array<string, mixed>>  $lines */
    private function replaceLines(JournalEntry $entry, array $lines): void
    {
        $accountIds = collect($lines)->pluck('account_id')->unique()->values();
        // Le scope d'entreprise garantit que seuls les comptes de l'entreprise courante sont comptés.
        if (Account::query()->whereIn('id', $accountIds)->count() !== $accountIds->count()) {
            throw new BusinessRuleException('Un des comptes référencés est invalide.', 'invalid_account');
        }

        $rows = [];
        foreach ($lines as $line) {
            $debit = Money::toCents($line['debit'] ?? 0);
            $credit = Money::toCents($line['credit'] ?? 0);

            if ($debit < 0 || $credit < 0 || ($debit > 0) === ($credit > 0)) {
                throw new BusinessRuleException(
                    'Chaque ligne doit comporter un montant au débit ou au crédit, mais pas les deux.',
                    'invalid_line_amount'
                );
            }

            $rows[] = [
                'account_id' => $line['account_id'],
                'label' => $line['label'] ?? null,
                'debit' => Money::fromCents($debit),
                'credit' => Money::fromCents($credit),
            ];
        }

        $entry->lines()->delete();
        foreach ($rows as $row) {
            $entry->lines()->create($row);
        }
    }

    private function assertJournalUsable(int $journalId): void
    {
        $journal = Journal::query()->whereKey($journalId)->first();

        if ($journal === null || ! $journal->is_active) {
            throw new BusinessRuleException('Journal invalide ou inactif.', 'invalid_journal');
        }
    }
}
