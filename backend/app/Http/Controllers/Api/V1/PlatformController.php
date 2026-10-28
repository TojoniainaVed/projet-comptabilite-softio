<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Admin\SettingsService;
use Illuminate\Http\JsonResponse;

/** Informations publiques non sensibles (identité visuelle de l'écran de connexion). */
class PlatformController extends Controller
{
    public function show(SettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->publicSettings()]);
    }
}
