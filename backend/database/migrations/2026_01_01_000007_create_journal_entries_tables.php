<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('journal_id')->constrained()->restrictOnDelete();
            $table->foreignId('fiscal_year_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('reference', 40)->nullable();
            $table->date('entry_date');
            $table->string('description');
            $table->string('status', 10)->default('draft'); // draft | posted | reversed
            $table->string('source_type', 30)->nullable(); // invoice | payment | expense
            $table->unsignedBigInteger('source_id')->nullable();
            $table->foreignId('reversal_of_id')->nullable()->constrained('journal_entries')->restrictOnDelete();
            $table->timestamp('reversed_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'reference']);
            $table->index(['company_id', 'status', 'entry_date']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('journal_entry_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->restrictOnDelete();
            $table->string('label')->nullable();
            $table->decimal('debit', 18, 2)->default(0);
            $table->decimal('credit', 18, 2)->default(0);

            $table->index('journal_entry_id');
            $table->index('account_id');
        });

        // Contraintes d'intégrité financière (PostgreSQL) : montants positifs, un seul sens par ligne.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE journal_entry_lines ADD CONSTRAINT journal_entry_lines_amounts_check CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0))');
            DB::statement("ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check CHECK (status IN ('draft', 'posted', 'reversed'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_entry_lines');
        Schema::dropIfExists('journal_entries');
    }
};
