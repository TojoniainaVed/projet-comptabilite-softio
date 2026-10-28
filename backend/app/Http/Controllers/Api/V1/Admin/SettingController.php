<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SettingsRequest;
use App\Services\Admin\SettingsService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    public function show(): JsonResponse
    {
        $this->authorize('settings.view');

        return response()->json(['data' => $this->settings->all()]);
    }

    public function update(SettingsRequest $request): JsonResponse
    {
        $this->authorize('settings.update');

        $before = $this->settings->all();
        $after = $this->settings->update($request->validated());

        $changes = [];
        foreach ($after as $key => $value) {
            if ($before[$key] !== $value) {
                $changes[$key] = ['from' => $before[$key], 'to' => $value];
            }
        }
        if ($changes !== []) {
            $this->audit->log('settings.updated', null, ['changes' => $changes]);
        }

        return response()->json(['data' => $after]);
    }
}
