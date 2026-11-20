<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class CompanyController extends Controller
{
    public function show(Request $request)
    {
        $company = $request->user()->company;

        abort_unless($company, 404, 'Entreprise introuvable.');

        Gate::authorize('view', $company);

        return CompanyResource::make($company);
    }
}