<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->decimal('rate', 5, 2);
            $table->string('scope', 10)->default('sales'); // sales | purchases
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name', 'scope']);
        });

        Schema::create('payment_terms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->unsignedSmallInteger('days')->default(0);
            $table->boolean('end_of_month')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        Schema::create('accounting_defaults', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();
            foreach (['receivable', 'payable', 'vat_collected', 'vat_deductible', 'bank', 'cash'] as $key) {
                $table->foreignId("{$key}_account_id")->nullable()->constrained('accounts')->nullOnDelete();
            }
            $table->timestamps();
        });

        // Entreprises existantes : TVA courante et conditions de paiement usuelles.
        $now = now();
        foreach (DB::table('companies')->pluck('id') as $companyId) {
            DB::table('taxes')->insert([
                ['company_id' => $companyId, 'name' => 'TVA 20 % (ventes)', 'rate' => 20, 'scope' => 'sales', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $companyId, 'name' => 'TVA 20 % (achats)', 'rate' => 20, 'scope' => 'purchases', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ]);
            DB::table('payment_terms')->insert([
                ['company_id' => $companyId, 'name' => 'Paiement comptant', 'days' => 0, 'end_of_month' => false, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $companyId, 'name' => '15 jours', 'days' => 15, 'end_of_month' => false, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $companyId, 'name' => '30 jours', 'days' => 30, 'end_of_month' => false, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
                ['company_id' => $companyId, 'name' => '45 jours fin de mois', 'days' => 45, 'end_of_month' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_defaults');
        Schema::dropIfExists('payment_terms');
        Schema::dropIfExists('taxes');
    }
};
