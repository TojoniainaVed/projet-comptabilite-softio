<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Services\Accounting\AccountingDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, AccountingDashboardService $dashboard): JsonResponse
    {
        $this->authorize('reports.view');

        return response()->json(['data' => $dashboard->summary($request->user()->company_id)]);
    }
}
