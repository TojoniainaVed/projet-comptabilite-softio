<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\UserPreferences;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Préférences d'interface de l'utilisateur connecté (aucune permission particulière : chacun gère les siennes). */
class PreferencesController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $rules = ['sidebar_collapsed' => ['sometimes', 'boolean']];
        foreach (UserPreferences::OPTIONS as $key => $allowed) {
            $rules[$key] = ['sometimes', Rule::in($allowed)];
        }

        $rules['status_colors'] = ['sometimes', 'array'];
        foreach (UserPreferences::STATUS_KEYS as $status) {
            $rules["status_colors.$status"] = ['sometimes', Rule::in(UserPreferences::STATUS_COLORS)];
        }

        $data = $request->validate($rules);
        if (isset($data['status_colors'])) {
            // Fusion : modifier un statut ne réinitialise pas les autres.
            $data['status_colors'] = array_merge($request->user()->preferences['status_colors'] ?? [], $data['status_colors']);
        }

        $user = $request->user();
        $merged = UserPreferences::sanitize(array_merge($user->preferences ?? [], $data));

        // forceFill : « preferences » n'est volontairement pas dans $fillable (jamais modifiable en masse).
        $user->forceFill(['preferences' => $merged])->save();

        return response()->json(['data' => $merged]);
    }
}
