<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\InvoiceRequest;
use App\Http\Requests\PaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Services\Accounting\InvoiceService;
use App\Services\Accounting\PaymentService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceService $invoices,
        private readonly PaymentService $payments,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Invoice::class);

        $query = Invoice::query()
            ->with('partner:id,name')
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')->value()))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->value()))
            ->when($request->filled('partner_id'), fn ($q) => $q->where('partner_id', $request->integer('partner_id')))
            ->when($request->boolean('overdue'), fn ($q) => $q->where('status', Invoice::STATUS_POSTED)->whereDate('due_date', '<', now()->toDateString()))
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where(
                fn ($w) => $w->where('number', 'like', $this->like($term))->orWhere('supplier_reference', 'like', $this->like($term))
            ))
            ->latest('invoice_date')->latest('id');

        return $this->listResponse($request, $query, InvoiceResource::class);
    }

    public function store(InvoiceRequest $request): JsonResponse
    {
        $this->authorize('create', Invoice::class);

        $invoice = $this->invoices->saveDraft($request->validated(), $request->user());
        $this->audit->log('invoice.created', $invoice, ['type' => $invoice->type, 'total' => $invoice->total]);

        return InvoiceResource::make($invoice)->response()->setStatusCode(201);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        $this->authorize('view', $invoice);

        return InvoiceResource::make($invoice->load('lines.account', 'partner'));
    }

    public function update(InvoiceRequest $request, Invoice $invoice): InvoiceResource
    {
        $this->authorize('update', $invoice);

        $invoice = $this->invoices->saveDraft($request->validated(), $request->user(), $invoice);
        $this->audit->log('invoice.updated', $invoice, ['total' => $invoice->total]);

        return InvoiceResource::make($invoice);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $this->authorize('delete', $invoice);

        $this->invoices->deleteDraft($invoice);
        $this->audit->log('invoice.deleted', $invoice);

        return $this->noContent();
    }

    public function post(Request $request, Invoice $invoice): InvoiceResource
    {
        $this->authorize('post', $invoice);

        return InvoiceResource::make($this->invoices->post($invoice, $request->user()));
    }

    public function cancel(Request $request, Invoice $invoice): InvoiceResource
    {
        $this->authorize('cancel', $invoice);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        return InvoiceResource::make($this->invoices->cancel($invoice, $request->user(), $data['reason'] ?? null));
    }

    /**
     * Enregistre un paiement. L'en-tête `Idempotency-Key` est obligatoire : rejouer la même requête
     * (double clic, nouvelle tentative réseau) renvoie le paiement initial sans en créer un second.
     */
    public function pay(PaymentRequest $request, Invoice $invoice): JsonResponse
    {
        $this->authorize('pay', $invoice);

        $key = (string) $request->header('Idempotency-Key', '');
        if (strlen($key) < 8 || strlen($key) > 64) {
            throw ValidationException::withMessages(['idempotency_key' => ["L'en-tête Idempotency-Key (8 à 64 caractères) est obligatoire."]]);
        }

        [$payment, $created] = $this->payments->register($invoice, $request->validated(), $key, $request->user());

        return PaymentResource::make($payment)->response()->setStatusCode($created ? 201 : 200);
    }
}
