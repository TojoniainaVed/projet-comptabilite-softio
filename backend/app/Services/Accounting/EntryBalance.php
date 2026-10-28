<?php

namespace App\Services\Accounting;

use App\Support\Money;

/**
 * Règle centrale de la partie double : total débit = total crédit.
 * Classe pure (sans accès base) afin d'être testable unitairement.
 */
final class EntryBalance
{
    /**
     * @param  iterable<object|array<string, mixed>>  $lines  objets ou tableaux avec `debit` et `credit`
     * @return array{debit:int, credit:int}
     */
    public static function totals(iterable $lines): array
    {
        $debit = 0;
        $credit = 0;

        foreach ($lines as $line) {
            $line = (array) (is_object($line) && method_exists($line, 'toArray') ? $line->toArray() : $line);
            $debit += Money::toCents($line['debit'] ?? 0);
            $credit += Money::toCents($line['credit'] ?? 0);
        }

        return ['debit' => $debit, 'credit' => $credit];
    }

    /** @param  array{debit:int, credit:int}  $totals */
    public static function isBalanced(array $totals): bool
    {
        return $totals['debit'] > 0 && $totals['debit'] === $totals['credit'];
    }
}
