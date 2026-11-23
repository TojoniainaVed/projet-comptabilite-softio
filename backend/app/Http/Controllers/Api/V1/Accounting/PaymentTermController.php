<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentTermResource;
use App\Models\PaymentTerm;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** Conditions de paiement (calcul de l'échéance d'une facture). Permissions : accounts.*. */
class PaymentTermController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('accounts.view');

        $query = PaymentTerm::query()
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('days')->orderBy('name');

        return $this->listResponse($request, $query, PaymentTermResource::class);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('accounts.create');

        $term = PaymentTerm::create($this->validated($request) + ['company_id' => $request->user()->company_id]);
        $this->audit->log('payment_term.created', $term, ['name' => $term->name]);

        return PaymentTermResource::make($term)->response()->setStatusCode(201);
    }

    public function update(Request $request, PaymentTerm $paymentTerm): PaymentTermResource
    {
        $this->authorize('accounts.update');

        $paymentTerm->fill($this->validated($request, $paymentTerm));
        $changed = array_keys($paymentTerm->getDirty());
        $paymentTerm->save();

        if ($changed !== []) {
            $this->audit->log('payment_term.updated', $paymentTerm, ['fields' => $changed]);
        }

        return PaymentTermResource::make($paymentTerm);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?PaymentTerm $term = null): array
    {
        return $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('payment_terms', 'name')
                    ->where('company_id', $request->user()->company_id)
                    ->ignore($term?->id),
            ],
            'days' => ['required', 'integer', 'min:0', 'max:365'],
            'end_of_month' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
