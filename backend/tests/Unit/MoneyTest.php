<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_converts_decimal_strings_to_exact_cents(): void
    {
        $this->assertSame(1999, Money::toCents('19.99'));
        $this->assertSame(10, Money::toCents('0.10'));
        $this->assertSame(0, Money::toCents(null));
        $this->assertSame(12345600, Money::toCents(123456));
    }

    public function test_formats_cents_with_two_decimals(): void
    {
        $this->assertSame('19.99', Money::fromCents(1999));
        $this->assertSame('0.05', Money::fromCents(5));
        $this->assertSame('-3.00', Money::fromCents(-300));
    }

    public function test_floating_point_sums_do_not_drift(): void
    {
        $total = 0;
        foreach (array_fill(0, 10, '0.10') as $amount) {
            $total += Money::toCents($amount);
        }

        $this->assertSame(100, $total);
    }
}
