<?php

namespace App\Services\Admin;

use App\Models\Setting;

/**
 * Paramètres de plateforme non secrets. Seules les clés connues de config/softio.php sont acceptées.
 */
class SettingsService
{
    /** @return array<string, mixed> */
    public function all(): array
    {
        $defaults = config('softio.defaults');
        $stored = Setting::query()->pluck('value', 'key')->all();

        $settings = [];
        foreach ($defaults as $key => $default) {
            $settings[$key] = array_key_exists($key, $stored)
                ? (is_array($default) ? array_replace($default, (array) $stored[$key]) : $stored[$key])
                : $default;
        }

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public function update(array $values): array
    {
        foreach (array_intersect_key($values, config('softio.defaults')) as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        return $this->all();
    }

    public function passwordMinLength(): int
    {
        return (int) $this->all()['password_min_length'];
    }

    /** Sous-ensemble exposé publiquement (écran de connexion). */
    public function publicSettings(): array
    {
        $all = $this->all();

        return [
            'platform_name' => $all['platform_name'],
            'brand_color' => $all['brand_color'],
            'default_locale' => $all['default_locale'],
            'password_min_length' => (int) $all['password_min_length'],
            'registration_enabled' => (bool) config('softio.registration.enabled'),
            'terms_url' => config('softio.registration.terms_url') ?: null,
        ];
    }
}
