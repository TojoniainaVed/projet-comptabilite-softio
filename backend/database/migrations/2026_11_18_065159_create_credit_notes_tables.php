<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_notes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('company_id')
                ->constrained()
                ->restrictOnDelete();

            $table->foreignId('invoice_id')
                ->constrained('invoices')
                ->restrictOnDelete();

            $table->foreignId('partner_id')
                ->constrained('partners')
                ->restrictOnDelete();

            $table->foreignId('journal_entry_id')
                ->nullable()
                ->constrained('journal_entries')
                ->restrictOnDelete();

            $table->string('type', 20);
            $table->string('number', 100)->nullable();
            $table->string('supplier_reference', 100)->nullable();

            $table->date('credit_note_date');
            $table->string('reason', 255);
            $table->text('notes')->nullable();

            $table->string('status', 20)->default('draft');

            $table->string('currency', 3)->default('MGA');
            $table->decimal('subtotal', 18, 2)->default(0);
            $table->decimal('tax_total', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);

            $table->timestamp('posted_at')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->unique(
                ['company_id', 'number'],
                'credit_notes_company_number_unique'
            );

            $table->index(
                ['company_id', 'type', 'status'],
                'credit_notes_company_type_status_index'
            );

            $table->index(
                ['company_id', 'invoice_id'],
                'credit_notes_company_invoice_index'
            );

            $table->index(
                ['company_id', 'credit_note_date'],
                'credit_notes_company_date_index'
            );
        });

        Schema::create('credit_note_lines', function (Blueprint $table) {
            $table->id();

            $table->foreignId('credit_note_id')
                ->constrained('credit_notes')
                ->cascadeOnDelete();

            $table->foreignId('invoice_line_id')
                ->nullable()
                ->constrained('invoice_lines')
                ->restrictOnDelete();

            $table->foreignId('account_id')
                ->constrained('accounts')
                ->restrictOnDelete();

            $table->string('description', 255);
            $table->decimal('quantity', 18, 2);
            $table->decimal('unit_price', 18, 2);
            $table->decimal('tax_rate', 5, 2)->default(0);

            $table->decimal('net_amount', 18, 2)->default(0);
            $table->decimal('tax_amount', 18, 2)->default(0);

            $table->timestamps();

            $table->index('credit_note_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_note_lines');
        Schema::dropIfExists('credit_notes');
    }
};
