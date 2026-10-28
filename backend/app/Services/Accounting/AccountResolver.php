<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\Journal;

/**
 * Retrouve les comptes et journaux « techniques » de l'entreprise courante
 * (clients, fournisseurs, TVA, banque...) à partir de leur catégorie ou de leur type.
 */
class AccountResolver
{
    public function byCategory(string $category): Account
    {
        $account = Account::query()
            ->where('category', $category)
            ->where('is_active', true)
            ->orderBy('code')
            ->first();

        return $account ?? throw new BusinessRuleException(
            "Aucun compte actif de catégorie « $category » n'est configuré.",
            'account_category_missing'
        );
    }

    public function journalByType(string $type): Journal
    {
        $journal = Journal::query()
            ->where('type', $type)
            ->where('is_active', true)
            ->orderBy('code')
            ->first();

        return $journal ?? throw new BusinessRuleException(
            "Aucun journal actif de type « $type » n'est configuré.",
            'journal_missing'
        );
    }

    /** Journal de trésorerie correspondant à un compte banque ou caisse. */
    public function treasuryJournal(Account $treasury): Journal
    {
        return $this->journalByType($treasury->category === 'cash' ? 'cash' : 'bank');
    }
}
