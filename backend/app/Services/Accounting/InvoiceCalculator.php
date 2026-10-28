<?php

namespace App\Services\Accounting;

use App\Support\Money;

/**
 * Calcul centralisé des totaux de facture (jamais fait confiance aux montants du client).
 * Classe pure, testable sans base de données.
 */
final class InvoiceCalculator
{
    /**
     * @param  list<array{quantity:mixed, unit_price:mixed, tax_rate?:mixed}>  $lines
     * @return array{lines: list<array{net_cents:int, tax_cents:int}>, subtotal_cents:int, tax_cents:int, total_cents:int}
     */
    public static function compute(array $lines): array
    {
        $computed = [];
        $subtotal = 0;
        $tax = 0;

        foreach ($lines as $line) {
            $net = (int) round(((float) $line['quantity']) * Money::toCents($line['unit_price']));
            $lineTax = (int) round($net * ((float) ($line['tax_rate'] ?? 0)) / 100);

            $computed[] = ['net_cents' => $net, 'tax_cents' => $lineTax];
            $subtotal += $net;
            $tax += $lineTax;
        }

        return [
            'lines' => $computed,
            'subtotal_cents' => $subtotal,
            'tax_cents' => $tax,
            'total_cents' => $subtotal + $tax,
        ];
    }
}
