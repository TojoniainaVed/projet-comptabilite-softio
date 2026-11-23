<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\TaxResource;
use App\Models\Tax;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** Taxes (TVA) de l'entreprise. Permissions : celles du plan comptable (accounts.*). */
class TaxController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('accounts.view');

        $query = Tax::query()
            ->when($request->filled('scope'), fn ($q) => $q->where('scope', $request->string('scope')->value()))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('scope')->orderBy('name');

        return $this->listResponse($request, $query, TaxResource::class);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('accounts.create');

        $tax = Tax::create($this->validated($request) + ['company_id' => $request->user()->company_id]);
        $this->audit->log('tax.created', $tax, ['name' => $tax->name, 'rate' => $tax->rate]);

        return TaxResource::make($tax)->response()->setStatusCode(201);
    }

    public function update(Request $request, Tax $tax): TaxResource
    {
        $this->authorize('accounts.update');

        $tax->fill($this->validated($request, $tax));
        $changed = array_keys($tax->getDirty());
        $tax->save();

        if ($changed !== []) {
            $this->audit->log('tax.updated', $tax, ['fields' => $changed]);
        }

        return TaxResource::make($tax);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Tax $tax = null): array
    {
        $scope = $request->input('scope', $tax?->scope);

        return $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('taxes', 'name')
                    ->where('company_id', $request->user()->company_id)
                    ->where('scope', $scope)
                    ->ignore($tax?->id),
            ],
            'rate' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'scope' => ['required', Rule::in(Tax::SCOPES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
