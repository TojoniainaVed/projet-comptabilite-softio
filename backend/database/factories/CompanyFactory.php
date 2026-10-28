<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Company> */
class CompanyFactory extends Factory
{
    protected $model = Company::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->company(),
            'currency' => 'MGA',
            'locale' => 'fr',
            'status' => Company::STATUS_ACTIVE,
        ];
    }

    public function suspended(): static
    {
        return $this->state(['status' => Company::STATUS_SUSPENDED]);
    }
}
