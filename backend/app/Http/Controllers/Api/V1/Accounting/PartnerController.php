<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\PartnerRequest;
use App\Http\Resources\PartnerResource;
use App\Models\Partner;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use App\Exceptions\BusinessRuleException;
use App\Models\Expense;
use App\Models\Invoice;

/** Clients (/customers) et fournisseurs (/suppliers) : même ressource, distinguée par le défaut de route `type`. */
class PartnerController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}


    /**
     * Suppression définitive, réservée aux fiches jamais utilisées : un client ou un fournisseur
     * qui a des factures ou des dépenses fait partie de l'historique comptable et se désactive.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->authorize('partners.update');

        $partner = $this->find($request, $id);
        $noun = $partner->type === Partner::TYPE_SUPPLIER ? 'fournisseur' : 'client';

        if (
            Invoice::query()->where('partner_id', $partner->id)->exists()
            || Expense::query()->where('partner_id', $partner->id)->exists()
        ) {
            throw new BusinessRuleException(
                "Ce $noun a des factures ou des dépenses : il ne peut pas être supprimé. Désactivez-le plutôt.",
                'partner_in_use',
            );
        }

        $partner->delete();
        $this->audit->log('partner.deleted', $partner, ['type' => $partner->type, 'name' => $partner->name]);

        return $this->noContent();
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('partners.view');

        $query = Partner::query()
            ->where('type', $this->type($request))
            ->when($request->string('search')->trim()->value(), fn($q, $term) => $q->where(
                fn($w) => $w->where('name', 'like', $this->like($term))->orWhere('email', 'like', $this->like($term))
            ))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name');

        return $this->listResponse($request, $query, PartnerResource::class);
    }

    public function store(PartnerRequest $request): JsonResponse
    {
        $this->authorize('partners.create');

        $partner = Partner::create($request->validated() + [
            'company_id' => $request->user()->company_id,
            'type' => $this->type($request),
        ]);
        $this->audit->log('partner.created', $partner, ['type' => $partner->type, 'name' => $partner->name]);

        return PartnerResource::make($partner)->response()->setStatusCode(201);
    }

    public function show(Request $request, int $id): PartnerResource
    {
        $this->authorize('partners.view');

        return PartnerResource::make($this->find($request, $id));
    }

    public function update(PartnerRequest $request, int $id): PartnerResource
    {
        $this->authorize('partners.update');

        $partner = $this->find($request, $id);
        $partner->fill($request->validated());
        $changed = array_keys($partner->getDirty());
        $partner->save();

        if ($changed !== []) {
            $this->audit->log('partner.updated', $partner, ['fields' => $changed]);
        }

        return PartnerResource::make($partner);
    }

    private function type(Request $request): string
    {
        return $request->route('type') === 'supplier' ? Partner::TYPE_SUPPLIER : Partner::TYPE_CUSTOMER;
    }

    private function find(Request $request, int $id): Partner
    {
        return Partner::query()->where('type', $this->type($request))->findOrFail($id);
    }
}
