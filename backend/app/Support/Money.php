<?php

namespace App\Support;

/**
 * Les montants sont manipulés en centimes (entiers) dans tout calcul métier.
 * Les entrées API sont validées à 2 décimales maximum (règle `decimal:0,2`),
 * ce qui rend la conversion exacte.
 */
final class Money
{
    public static function toCents(string|int|float|null $amount): int
    {
        return (int) round(((float) ($amount ?? 0)) * 100);
    }

    public static function fromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
