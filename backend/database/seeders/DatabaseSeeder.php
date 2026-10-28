<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        $email = env('SEED_ADMIN_EMAIL', 'admin@softio.test');
        if (User::query()->where('email', $email)->exists()) {
            $this->command?->info("Le super administrateur $email existe déjà.");
        } else {
            // Aucun mot de passe en dur : défini par l'environnement, sinon généré et affiché une seule fois.
            $password = env('SEED_ADMIN_PASSWORD') ?: Str::password(16);

            User::create([
                'name' => 'Super administrateur',
                'email' => $email,
                'password' => $password,
                'role_id' => Role::query()->where('slug', PermissionCatalog::SUPER_ADMIN)->value('id'),
                'is_active' => true,
            ]);

            $this->command?->warn("Super administrateur créé : $email");
            if (! env('SEED_ADMIN_PASSWORD')) {
                $this->command?->warn("Mot de passe généré (à noter maintenant, il ne sera plus affiché) : $password");
            }
        }

        // Données de démonstration : uniquement si DEMO_DATA=true (jamais en production).
        if (filter_var(env('DEMO_DATA', false), FILTER_VALIDATE_BOOL)) {
            $this->call(DemoSeeder::class);
        }
    }
}
