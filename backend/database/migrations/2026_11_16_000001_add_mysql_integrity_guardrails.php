<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $checks = [
            [
                'table' => 'journal_entry_lines',
                'constraint' => 'journal_entry_lines_amounts_check',
                'expression' => "CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0))",
            ],
            [
                'table' => 'journal_entries',
                'constraint' => 'journal_entries_status_check',
                'expression' => "CHECK (status IN ('draft', 'posted', 'reversed'))",
            ],
            [
                'table' => 'invoices',
                'constraint' => 'invoices_amounts_check',
                'expression' => 'CHECK (total >= 0 AND amount_paid >= 0 AND amount_paid <= total)',
            ],
            [
                'table' => 'payments',
                'constraint' => 'payments_amount_check',
                'expression' => 'CHECK (amount > 0)',
            ],
            [
                'table' => 'expenses',
                'constraint' => 'expenses_amount_check',
                'expression' => 'CHECK (amount > 0)',
            ],
        ];

        foreach ($checks as $check) {
            $table = $check['table'];
            $constraint = $check['constraint'];
            $expression = $check['expression'];

            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} {$expression}");
        }

        DB::unprepared("CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Le journal d\'audit est en lecture seule.'; END");
        DB::unprepared("CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Le journal d\'audit est en lecture seule.'; END");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_delete');
        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_update');

        foreach (['journal_entry_lines_amounts_check', 'journal_entries_status_check', 'invoices_amounts_check', 'payments_amount_check', 'expenses_amount_check'] as $constraint) {
            $table = match ($constraint) {
                'journal_entry_lines_amounts_check' => 'journal_entry_lines',
                'journal_entries_status_check' => 'journal_entries',
                'invoices_amounts_check' => 'invoices',
                'payments_amount_check' => 'payments',
                'expenses_amount_check' => 'expenses',
            };

            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$constraint}");
        }
    }
};
