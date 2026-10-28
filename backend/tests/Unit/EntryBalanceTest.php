<?php

namespace Tests\Unit;

use App\Services\Accounting\EntryBalance;
use PHPUnit\Framework\TestCase;

class EntryBalanceTest extends TestCase
{
    public function test_balanced_lines(): void
    {
        $totals = EntryBalance::totals([
            ['debit' => '100.10', 'credit' => 0],
            ['debit' => '0', 'credit' => '40.04'],
            ['debit' => 0, 'credit' => '60.06'],
        ]);

        $this->assertSame(['debit' => 10010, 'credit' => 10010], $totals);
        $this->assertTrue(EntryBalance::isBalanced($totals));
    }

    public function test_one_cent_difference_is_unbalanced(): void
    {
        $totals = EntryBalance::totals([
            ['debit' => '100.00', 'credit' => 0],
            ['debit' => 0, 'credit' => '99.99'],
        ]);

        $this->assertFalse(EntryBalance::isBalanced($totals));
    }

    public function test_empty_or_zero_entry_is_never_balanced(): void
    {
        $this->assertFalse(EntryBalance::isBalanced(EntryBalance::totals([])));
        $this->assertFalse(EntryBalance::isBalanced(EntryBalance::totals([['debit' => 0, 'credit' => 0]])));
    }

    public function test_accepts_objects(): void
    {
        $totals = EntryBalance::totals([(object) ['debit' => '5.00', 'credit' => '0.00'], (object) ['debit' => '0.00', 'credit' => '5.00']]);

        $this->assertTrue(EntryBalance::isBalanced($totals));
    }
}
