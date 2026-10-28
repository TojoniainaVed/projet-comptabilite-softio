<?php

use App\Models\User;
use App\Services\Admin\SettingsService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

Artisan::command('softio:reset-password {email : Adresse e-mail du compte}', function (SettingsService $settings) {
    $user = User::query()
        ->withoutGlobalScopes()
        ->whereRaw('lower(email) = ?', [mb_strtolower((string) $this->argument('email'))])
        ->first();

    if ($user === null) {
        $this->error('Aucun compte avec cette adresse e-mail. Avez-vous lancé « php artisan db:seed » ?');

        return self::FAILURE;
    }

    // Saisie masquée : le mot de passe n'apparaît ni à l'écran ni dans l'historique du terminal.
    $password = (string) $this->secret('Nouveau mot de passe');
    $confirmation = (string) $this->secret('Confirmez le mot de passe');

    if ($password !== $confirmation) {
        $this->error('Les deux saisies sont différentes.');

        return self::FAILURE;
    }

    $validator = Validator::make(
        ['password' => $password],
        ['password' => ['required', 'string', Password::min($settings->passwordMinLength())->mixedCase()->numbers()]],
    );

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $message) {
            $this->error($message);
        }

        return self::FAILURE;
    }

    $user->forceFill([
        'email' => mb_strtolower($user->email),
        'password' => $password,
        'is_active' => true,
    ])->save();
    $user->tokens()->delete();

    $this->info("Mot de passe mis à jour pour {$user->email} (compte activé, sessions fermées).");

    return self::SUCCESS;
})->purpose('Réinitialise le mot de passe d\'un compte (et le réactive)');
