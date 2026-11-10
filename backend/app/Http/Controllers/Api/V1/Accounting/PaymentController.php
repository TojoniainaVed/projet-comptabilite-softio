<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Les paiements se créent via POST /invoices/{invoice}/payments ; ici : consultation uniquement. */
class PaymentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('payments.view');

        $query = Payment::query()
            ->with(['invoice:id,number,type', 'treasuryAccount:id,code,name'])
            ->when($request->filled('invoice_id'), fn ($q) => $q->where('invoice_id', $request->integer('invoice_id')))
            // Sens : « in » = encaissements (factures clients), « out » = décaissements (factures fournisseurs).
            ->when(in_array($request->query('direction'), ['in', 'out'], true), fn ($q) => $q->whereHas(
                'invoice',
                fn ($i) => $i->where('type', $request->query('direction') === 'in' ? Invoice::TYPE_CUSTOMER : Invoice::TYPE_SUPPLIER),
            ))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('paid_on', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('paid_on', '<=', $request->date('to')))
            ->latest('paid_on')->latest('id');

        return $this->listResponse($request, $query, PaymentResource::class);
    }

    public function show(Payment $payment): PaymentResource
    {
        $this->authorize('payments.view');

        return PaymentResource::make($payment->load(['invoice:id,number,type', 'treasuryAccount:id,code,name']));
    }
}
