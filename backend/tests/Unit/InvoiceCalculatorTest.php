<?php

namespace Tests\Unit;

use App\Services\Accounting\InvoiceCalculator;
use PHPUnit\Framework\TestCase;

class InvoiceCalculatorTest extends TestCase
{
    public function test_computes_net_tax_and_total_per_line(): void
    {
        $result = InvoiceCalculator::compute([
            ['quantity' => '2', 'unit_price' => '50.00', 'tax_rate' => '20'],
            ['quantity' => '1.5', 'unit_price' => '10.00', 'tax_rate' => '0'],
        ]);

        $this->assertSame([10000, 1500], array_column($result['lines'], 'net_cents'));
        $this->assertSame([2000, 0], array_column($result['lines'], 'tax_cents'));
        $this->assertSame(11500, $result['subtotal_cents']);
        $this->assertSame(2000, $result['tax_cents']);
        $this->assertSame(13500, $result['total_cents']);
    }

    public function test_tax_is_rounded_per_line(): void
    {
        $result = InvoiceCalculator::compute([['quantity' => '1', 'unit_price' => '0.99', 'tax_rate' => '20']]);

        $this->assertSame(99, $result['subtotal_cents']);
        $this->assertSame(20, $result['tax_cents']); // 19,8 centimes arrondis à 20
    }

    public function test_missing_tax_rate_means_zero(): void
    {
        $result = InvoiceCalculator::compute([['quantity' => '3', 'unit_price' => '10.00']]);

        $this->assertSame(3000, $result['total_cents']);
    }
}
