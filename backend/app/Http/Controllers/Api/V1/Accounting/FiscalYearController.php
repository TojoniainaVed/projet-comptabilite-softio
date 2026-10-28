<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\FiscalYearRequest;
use App\Http\Resources\FiscalYearResource;
use App\Models\FiscalYear;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FiscalYearController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('fiscal_years.view');

        return $this->listResponse($request, FiscalYear::query()->orderByDesc('starts_on'), FiscalYearResource::class);
    }

    public function store(FiscalYearRequest $request): JsonResponse
    {
        $this->authorize('fiscal_years.create');

        $year = FiscalYear::create($request->safe()->except('status') + [
            'company_id' => $request->user()->company_id,
            'status' => FiscalYear::STATUS_OPEN,
        ]);
        $this->audit->log('fiscal_year.created', $year, ['name' => $year->name]);

        return FiscalYearResource::make($year)->response()->setStatusCode(201);
    }

    /** La clôture (status = closed) interdit toute nouvelle validation d'écriture sur la période. */
    public function update(FiscalYearRequest $request, FiscalYear $fiscalYear): FiscalYearResource
    {
        $this->authorize('fiscal_years.update');

        $fiscalYear->fill($request->validated());
        $changed = array_keys($fiscalYear->getDirty());
        $fiscalYear->save();

        if ($changed !== []) {
            $this->audit->log(
                $fiscalYear->status === FiscalYear::STATUS_CLOSED && in_array('status', $changed, true) ? 'fiscal_year.closed' : 'fiscal_year.updated',
                $fiscalYear,
                ['fields' => $changed],
            );
        }

        return FiscalYearResource::make($fiscalYear);
    }
}
