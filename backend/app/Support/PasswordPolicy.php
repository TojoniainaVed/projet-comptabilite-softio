<?php

namespace App\Support;

use App\Services\Admin\SettingsService;
use Illuminate\Validation\Rules\Password;

/** Politique de mot de passe unique : longueur minimale configurable par la plateforme, majuscules, minuscules, chiffres. */
final class PasswordPolicy
{
    public static function rule(): Password
    {
        return Password::min(app(SettingsService::class)->passwordMinLength())->mixedCase()->numbers();
    }
}
