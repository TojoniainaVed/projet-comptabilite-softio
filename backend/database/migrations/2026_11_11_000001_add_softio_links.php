<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lien avec Softio (projet principal) : un utilisateur Softio correspond à un utilisateur Compta,
 * une entreprise Softio (le client propriétaire) à une entreprise Compta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->unsignedBigInteger('softio_organisation_id')->nullable()->unique()->after('id');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedBigInteger('softio_user_id')->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['softio_user_id']);
            $table->dropColumn('softio_user_id');
        });

        Schema::table('companies', function (Blueprint $table): void {
            $table->dropUnique(['softio_organisation_id']);
            $table->dropColumn('softio_organisation_id');
        });
    }
};
