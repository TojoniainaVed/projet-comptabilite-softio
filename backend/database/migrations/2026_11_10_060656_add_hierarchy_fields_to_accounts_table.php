<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table): void {
            // Compte parent pour construire l'arborescence.
            $table->foreignId('parent_id')
                ->nullable()
                ->after('company_id')
                ->constrained('accounts')
                ->restrictOnDelete();

            // Distingue les comptes de regroupement des comptes de détail.
            $table->boolean('is_group')
                ->default(false)
                ->after('category');

            $table->index(['company_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table): void {
            $table->dropForeign(['parent_id']);
            $table->dropIndex(['company_id', 'parent_id']);
            $table->dropColumn(['parent_id', 'is_group']);
        });
    }
};