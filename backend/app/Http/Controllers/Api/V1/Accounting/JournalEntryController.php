<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\JournalEntryRequest;
use App\Http\Resources\JournalEntryResource;
use App\Models\JournalEntry;
use App\Services\Accounting\JournalEntryService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class JournalEntryController extends Controller
{
    public function __construct(
        private readonly JournalEntryService $entries,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', JournalEntry::class);

        return $this->listResponse(
    $request,
    $this->filtered($request)
        ->with(['journal', 'lines.account'])
        ->latest('entry_date')
        ->latest('id'),
    JournalEntryResource::class
);
    }

    public function store(JournalEntryRequest $request): JsonResponse
    {
        $this->authorize('create', JournalEntry::class);

        $entry = $this->entries->createDraft($request->validated(), $request->user());
        $this->audit->log('journal_entry.created', $entry);

        return JournalEntryResource::make($entry)->response()->setStatusCode(201);
    }

    public function show(JournalEntry $journalEntry): JournalEntryResource
    {
        $this->authorize('view', $journalEntry);

        return JournalEntryResource::make($journalEntry->load('journal', 'lines.account'));
    }

    public function update(JournalEntryRequest $request, JournalEntry $journalEntry): JournalEntryResource
    {
        $this->authorize('update', $journalEntry);

        $entry = $this->entries->updateDraft($journalEntry, $request->validated());
        $this->audit->log('journal_entry.updated', $entry);

        return JournalEntryResource::make($entry);
    }

    public function destroy(JournalEntry $journalEntry): JsonResponse
    {
        $this->authorize('delete', $journalEntry);

        $this->entries->deleteDraft($journalEntry);
        $this->audit->log('journal_entry.deleted', $journalEntry);

        return $this->noContent();
    }

    public function post(Request $request, JournalEntry $journalEntry): JournalEntryResource
    {
        $this->authorize('post', $journalEntry);

        return JournalEntryResource::make($this->entries->post($journalEntry, $request->user()));
    }

    public function reverse(Request $request, JournalEntry $journalEntry): JournalEntryResource
    {
        $this->authorize('reverse', $journalEntry);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:200'],
            'entry_date' => ['nullable', 'date'],
        ]);

        return JournalEntryResource::make(
            $this->entries->reverse($journalEntry, $request->user(), $data['reason'] ?? null, $data['entry_date'] ?? null)
        );
    }

    /** Export CSV des lignes d'écritures validées (permission entries.export). */
    public function export(Request $request): StreamedResponse
    {
        $this->authorize('export', JournalEntry::class);

        $query = $this->filtered($request)->where('status', '!=', JournalEntry::STATUS_DRAFT)->with(['journal', 'lines.account'])->orderBy('entry_date')->orderBy('id');
        $this->audit->log('journal_entry.exported');

        return response()->streamDownload(function () use ($query): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 pour Excel
            fputcsv($out, ['Référence', 'Date', 'Journal', 'Description', 'Compte', 'Libellé du compte', 'Libellé', 'Débit', 'Crédit'], ';');
            $query->chunk(200, function ($entries) use ($out): void {
                foreach ($entries as $entry) {
                    foreach ($entry->lines as $line) {
                        fputcsv($out, [
                            $entry->reference, $entry->entry_date->toDateString(), $entry->journal?->code, $entry->description,
                            $line->account?->code, $line->account?->name, $line->label, $line->debit, $line->credit,
                        ], ';');
                    }
                }
            });
            fclose($out);
        }, 'ecritures.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filtered(Request $request)
    {
        return JournalEntry::query()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->value()))
            ->when($request->filled('journal_id'), fn ($q) => $q->where('journal_id', $request->integer('journal_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('entry_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('entry_date', '<=', $request->date('to')))
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where(
                fn ($w) => $w->where('reference', 'like', $this->like($term))->orWhere('description', 'like', $this->like($term))
            ));
    }
}
