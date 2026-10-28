<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\CompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Services\Accounting\CompanyAccountingBootstrap;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class CompanyController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Company::class);

        $user = $request->user();
        $query = Company::query()
            ->withCount('users')
            ->when(! $user->isPlatformAdmin(), fn ($q) => $q->whereKey($user->company_id))
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where('name', 'like', $this->like($term)))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->value()))
            ->orderBy('name');

        return $this->listResponse($request, $query, CompanyResource::class);
    }

    public function store(CompanyRequest $request, CompanyAccountingBootstrap $bootstrap): JsonResponse
    {
        $this->authorize('create', Company::class);

        $company = DB::transaction(function () use ($request, $bootstrap): Company {
            $company = Company::create($request->safe()->except('status') + ['status' => Company::STATUS_ACTIVE]);
            $bootstrap->run($company);

            return $company;
        });
        $this->audit->log('company.created', $company, ['name' => $company->name]);

        return CompanyResource::make($company)->response()->setStatusCode(201);
    }

    public function show(Company $company): CompanyResource
    {
        $this->authorize('view', $company);

        return CompanyResource::make($company->loadCount('users'));
    }

    public function update(CompanyRequest $request, Company $company): CompanyResource
    {
        $this->authorize('update', $company);

        $data = $request->validated();
        if (isset($data['status']) && $data['status'] !== $company->status) {
            $this->authorize('administer', $company); // suspendre / réactiver : plateforme uniquement
        } else {
            unset($data['status']);
        }

        $company->fill($data);
        $changed = array_keys($company->getDirty());
        $company->save();

        if ($changed !== []) {
            $this->audit->log(
                in_array('status', $changed, true) ? "company.{$company->status}" : 'company.updated',
                $company,
                ['fields' => $changed],
            );
        }

        return CompanyResource::make($company->loadCount('users'));
    }
}
