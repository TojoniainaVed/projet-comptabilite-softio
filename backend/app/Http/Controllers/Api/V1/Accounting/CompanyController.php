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

    /** Informations légales de la société (la devise et le statut ne se modifient pas ici). */
    public function update(Request $request)
    {
        $company = $request->user()->company;

        abort_unless($company, 404, 'Entreprise introuvable.');

        Gate::authorize('update', $company);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        $company->fill($data);
        $changed = array_keys($company->getDirty());
        $company->save();

        if ($changed !== []) {
            app(\App\Services\Audit\AuditLogger::class)->log('company.updated', $company, ['fields' => $changed]);
        }

        return CompanyResource::make($company);
    }
}