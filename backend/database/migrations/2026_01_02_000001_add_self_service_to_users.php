<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Inscription en libre-service : confirmation d'adresse e-mail et réinitialisation de mot de passe.
 *
 * `must_verify_email` vaut true uniquement pour les comptes qui se sont inscrits eux-mêmes et n'ont pas
 * encore cliqué sur le lien : les comptes existants (super administrateur, comptes créés par un
 * administrateur) restent donc utilisables sans changement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('email_verified_at')->nullable()->after('email');
            $table->boolean('must_verify_email')->default(false)->after('is_active');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Les adresses sont désormais enregistrées en minuscules (la connexion les compare en minuscules).
        DB::table('users')->update(['email' => DB::raw('lower(email)')]);
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['email_verified_at', 'must_verify_email']);
        });
    }
};
