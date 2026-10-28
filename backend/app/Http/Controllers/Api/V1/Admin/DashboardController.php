<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\AdminDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, AdminDashboardService $dashboard): JsonResponse
    {
        // L'accès au tableau de bord d'administration suppose de pouvoir consulter les utilisateurs.
        $this->authorize('users.view');

        return response()->json(['data' => $dashboard->summary($request->user())]);
    }
}
