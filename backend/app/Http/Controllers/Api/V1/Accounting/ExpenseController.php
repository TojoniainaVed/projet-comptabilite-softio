<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Services\Accounting\ExpenseService;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ExpenseController extends Controller
{
    public function __construct(
        private readonly ExpenseService $expenses,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Expense::class);

        $query = Expense::query()
            ->with(['account:id,code,name', 'paidFromAccount:id,code,name', 'partner:id,name'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->value()))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('expense_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('expense_date', '<=', $request->date('to')))
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where('description', 'like', $this->like($term)))
            ->latest('expense_date')->latest('id');

        return $this->listResponse($request, $query, ExpenseResource::class);
    }

    public function store(ExpenseRequest $request): JsonResponse
    {
        $this->authorize('create', Expense::class);

        $expense = $this->expenses->saveDraft($request->validated(), $request->user());
        $this->audit->log('expense.created', $expense, ['amount' => $expense->amount]);

        return ExpenseResource::make($expense)->response()->setStatusCode(201);
    }

    public function show(Expense $expense): ExpenseResource
    {
        $this->authorize('view', $expense);

        return ExpenseResource::make($expense->load('account', 'paidFromAccount', 'partner'));
    }

    public function update(ExpenseRequest $request, Expense $expense): ExpenseResource
    {
        $this->authorize('update', $expense);

        return ExpenseResource::make($this->expenses->saveDraft($request->validated(), $request->user(), $expense));
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $this->authorize('delete', $expense);

        if (! $expense->isDraft()) {
            throw new BusinessRuleException('Seule une dépense brouillon peut être supprimée.', 'expense_not_draft');
        }
        $expense->delete();
        $this->audit->log('expense.deleted', $expense);

        return $this->noContent();
    }

    public function post(Request $request, Expense $expense): ExpenseResource
    {
        $this->authorize('post', $expense);

        return ExpenseResource::make($this->expenses->post($expense, $request->user()));
    }
}
