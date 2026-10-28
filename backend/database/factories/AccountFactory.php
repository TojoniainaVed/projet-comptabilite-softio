<?php

namespace Database\Factories;

use App\Models\Account;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Account> */
class AccountFactory extends Factory
{
    protected $model = Account::class;

    public function definition(): array
    {
        return [
            'code' => (string) fake()->unique()->numberBetween(7000, 9999),
            'name' => fake()->words(2, true),
            'type' => 'expense',
            'is_active' => true,
        ];
    }
}
