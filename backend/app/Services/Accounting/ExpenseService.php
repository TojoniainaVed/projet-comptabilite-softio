<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\Expense;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function __construct(
        private readonly JournalEntryService $entries,
        private readonly AccountResolver $resolver,
        private readonly AuditLogger $audit,
    ) {}

    /** @param  array<string, mixed>  $data */
    public function saveDraft(array $data, User $user, ?Expense $expense = null): Expense
    {
        if ($expense !== null && ! $expense->isDraft()) {
            throw new BusinessRuleException('Seule une dépense brouillon peut être modifiée.', 'expense_not_draft');
        }

        $this->assertAccounts((int) $data['account_id'], (int) $data['paid_from_account_id']);

        $attributes = [
            'expense_date' => $data['expense_date'],
            'description' => $data['description'],
            'amount' => Money::fromCents(Money::toCents($data['amount'])),
            'account_id' => $data['account_id'],
            'paid_from_account_id' => $data['paid_from_account_id'],
            'partner_id' => $data['partner_id'] ?? null,
            'reference' => $data['reference'] ?? null,
        ];

        if ($expense === null) {
            $expense = Expense::create($attributes + [
                'company_id' => $user->company_id,
                'status' => Expense::STATUS_DRAFT,
                'created_by' => $user->id,
            ]);
        } else {
            $expense->update($attributes);
        }

        return $expense->load('account', 'paidFromAccount', 'partner');
    }

    public function post(Expense $expense, User $user): Expense
    {
        return DB::transaction(function () use ($expense, $user): Expense {
            $locked = Expense::query()->whereKey($expense->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isDraft()) {
                throw new BusinessRuleException('Seule une dépense brouillon peut être validée.', 'expense_not_draft');
            }

            $paidFrom = Account::query()->findOrFail($locked->paid_from_account_id);
            $journal = in_array($paidFrom->category, ['bank', 'cash'], true)
                ? $this->resolver->treasuryJournal($paidFrom)
                : $this->resolver->journalByType('general');

            $entry = $this->entries->createDraft([
                'journal_id' => $journal->id,
                'entry_date' => $locked->expense_date->toDateString(),
                'description' => 'Dépense — '.$locked->description,
                'lines' => [
                    ['account_id' => $locked->account_id, 'label' => $locked->description, 'debit' => $locked->amount, 'credit' => 0],
                    ['account_id' => $locked->paid_from_account_id, 'label' => $locked->description, 'debit' => 0, 'credit' => $locked->amount],
                ],
            ], $user, 'expense', $locked->id);
            $entry = $this->entries->post($entry, $user);

            $locked->update(['status' => Expense::STATUS_POSTED, 'journal_entry_id' => $entry->id]);
            $this->audit->log('expense.posted', $locked, ['amount' => $locked->amount], $user);

            return $locked->load('account', 'paidFromAccount', 'partner');
        });
    }

    private function assertAccounts(int $expenseAccountId, int $paidFromId): void
    {
        $expenseAccount = Account::query()->whereKey($expenseAccountId)->where('is_active', true)->first();
        $paidFrom = Account::query()->whereKey($paidFromId)->where('is_active', true)->first();

        if ($expenseAccount === null || $expenseAccount->type !== 'expense') {
            throw new BusinessRuleException('Le compte de dépense doit être un compte de charges actif.', 'invalid_expense_account');
        }
        if ($paidFrom === null || $paidFrom->id === $expenseAccount->id) {
            throw new BusinessRuleException('Le compte de règlement est invalide.', 'invalid_paid_from_account');
        }
    }
}
