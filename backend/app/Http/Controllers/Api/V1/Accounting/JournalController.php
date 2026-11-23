<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Exceptions\BusinessRuleException;
use App\Http\Requests\JournalRequest;
use App\Http\Resources\JournalResource;
use App\Models\Journal;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class JournalController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('journals.view');

        $query = Journal::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')->value()))
            ->orderBy('code');

        return $this->listResponse($request, $query, JournalResource::class);
    }

    public function store(JournalRequest $request): JsonResponse
    {
        $this->authorize('journals.create');

        $journal = Journal::create($request->validated() + ['company_id' => $request->user()->company_id]);
        $this->audit->log('journal.created', $journal, ['code' => $journal->code]);

        return JournalResource::make($journal)->response()->setStatusCode(201);
    }

    public function update(JournalRequest $request, Journal $journal): JournalResource
    {
        $this->authorize('journals.update');

        $data = $request->validated();

        // La numérotation ne peut qu'avancer : reculer créerait des références en double.
        if (isset($data['next_number']) && $data['next_number'] < $journal->next_number) {
            throw new BusinessRuleException(
                "Le prochain numéro ne peut pas être inférieur à {$journal->next_number} (numéros déjà attribués).",
                'sequence_backwards',
            );
        }

        $journal->fill($data);
        $changed = array_keys($journal->getDirty());
        $journal->save();

        if ($changed !== []) {
            $this->audit->log('journal.updated', $journal, ['fields' => $changed]);
        }

        return JournalResource::make($journal);
    }
}
