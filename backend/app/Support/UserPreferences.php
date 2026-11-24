<?php

namespace App\Support;

/**
 * Préférences d'interface d'un utilisateur : valeurs autorisées et valeurs par défaut.
 * Toute valeur inconnue est ignorée à la lecture, donc une préférence périmée ne casse jamais l'affichage.
 */
final class UserPreferences
{
    public const OPTIONS = [
        'theme' => ['light', 'dark', 'system'],
        'accent' => ['teal', 'blue', 'violet', 'orange', 'rose', 'slate'],
        'sidebar' => ['green', 'accent', 'dark', 'light'],
        'density' => ['comfortable', 'compact'],
        'font_size' => ['small', 'normal', 'large'],
    ];

    /** Statuts dont la couleur est personnalisable, et couleurs autorisées. */
    public const STATUS_KEYS = ['draft', 'validated', 'paid', 'cancelled', 'reversed'];

    public const STATUS_COLORS = ['black', 'gray', 'green', 'teal', 'blue', 'violet', 'rose', 'red', 'orange'];

    public const STATUS_DEFAULTS = [
        'draft' => 'black',
        'validated' => 'green',
        'paid' => 'blue',
        'cancelled' => 'red',
        'reversed' => 'orange',
    ];

    public const DEFAULTS = [
        'theme' => 'light',
        'accent' => 'teal',
        'sidebar' => 'green',
        'density' => 'comfortable',
        'font_size' => 'normal',
        'sidebar_collapsed' => false,
        'status_colors' => self::STATUS_DEFAULTS,
    ];

    /**
     * @param  array<string, mixed>|null  $stored
     * @return array<string, mixed>
     */
    public static function sanitize(?array $stored): array
    {
        $result = self::DEFAULTS;

        foreach (self::OPTIONS as $key => $allowed) {
            if (isset($stored[$key]) && in_array($stored[$key], $allowed, true)) {
                $result[$key] = $stored[$key];
            }
        }

        if (isset($stored['sidebar_collapsed']) && is_bool($stored['sidebar_collapsed'])) {
            $result['sidebar_collapsed'] = $stored['sidebar_collapsed'];
        }

        foreach (self::STATUS_KEYS as $status) {
            $color = $stored['status_colors'][$status] ?? null;
            if (is_string($color) && in_array($color, self::STATUS_COLORS, true)) {
                $result['status_colors'][$status] = $color;
            }
        }

        return $result;
    }
}
