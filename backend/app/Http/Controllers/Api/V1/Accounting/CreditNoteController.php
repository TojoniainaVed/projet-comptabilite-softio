<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreditNoteRequest;
use App\Http\Resources\CreditNoteResource;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Services\Accounting\CreditNoteService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CreditNoteController extends Controller
{
    public function __construct(
        private readonly CreditNoteService $creditNotes,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Liste des avoirs clients et fournisseurs.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', CreditNote::class);

        $query = CreditNote::query()
            ->with('partner:id,name,type')
            ->with('invoice:id,number,type,status,invoice_date,total')
            ->when(
                $request->filled('type'),
                fn ($q) => $q->where('type', $request->string('type')->value())
            )
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->string('status')->value())
            )
            ->when(
                $request->filled('partner_id'),
                fn ($q) => $q->where('partner_id', $request->integer('partner_id'))
            )
            ->when(
                $request->string('search')->trim()->value(),
                fn ($q, $term) => $q->where(
                    fn ($w) => $w
                        ->where('number', 'like', $this->like($term))
                        ->orWhere('supplier_reference', 'like', $this->like($term))
                )
            )
            ->latest('credit_note_date')
            ->latest('id');

        return $this->listResponse(
            $request,
            $query,
            CreditNoteResource::class
        );
    }

    /**
     * Création d'un avoir en brouillon.
     */
    public function store(CreditNoteRequest $request): JsonResponse
    {
        $this->authorize('create', CreditNote::class);

        $data = $request->validated();

        $invoice = Invoice::query()
            ->findOrFail($data['invoice_id']);

        $creditNote = $this->creditNotes->saveDraft(
            $invoice,
            $data,
            $request->user()
        );

        $this->audit->log(
            'credit_note.created',
            $creditNote,
            [
                'type' => $creditNote->type,
                'total' => $creditNote->total,
                'invoice_id' => $creditNote->invoice_id,
            ]
        );

        return CreditNoteResource::make($creditNote)
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Affichage du détail d'un avoir.
     */
    public function show(CreditNote $creditNote): CreditNoteResource
    {
        $this->authorize('view', $creditNote);

        return CreditNoteResource::make(
            $creditNote->load([
                'invoice',
                'partner',
                'lines.account',
                'creator',
            ])
        );
    }

    /**
     * Validation d'un avoir et génération de son écriture comptable.
     */
    public function post(
        CreditNote $creditNote,
        Request $request
    ): CreditNoteResource {
        $this->authorize('post', $creditNote);

        $creditNote = $this->creditNotes->post(
            $creditNote,
            $request->user()
        );

        return CreditNoteResource::make($creditNote);
    }
}