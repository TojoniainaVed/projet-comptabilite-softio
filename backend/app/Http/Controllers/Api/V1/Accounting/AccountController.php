<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Http\Requests\AccountRequest;
use App\Http\Resources\AccountResource;
use App\Models\Account;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AccountController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('accounts.view');

        $query = Account::query()
            ->when($request->string('search')->trim()->value(), fn ($q, $term) => $q->where(
                fn ($w) => $w->where('code', 'like', $this->like($term))->orWhere('name', 'like', $this->like($term))
            ))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')->value()))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')->value()))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('code');

        return $this->listResponse($request, $query, AccountResource::class);
    }

    public function store(AccountRequest $request): JsonResponse
    {
        $this->authorize('accounts.create');

        $account = Account::create($request->validated() + ['company_id' => $request->user()->company_id]);
        $this->audit->log('account.created', $account, ['code' => $account->code]);

        return AccountResource::make($account)->response()->setStatusCode(201);
    }

    public function show(Account $account): AccountResource
    {
        $this->authorize('accounts.view');

        return AccountResource::make($account);
    }

    public function update(AccountRequest $request, Account $account): AccountResource
    {
        $this->authorize('accounts.update');

        $account->fill($request->validated());
        $changed = array_keys($account->getDirty());
        $account->save();

        if ($changed !== []) {
            $this->audit->log('account.updated', $account, ['fields' => $changed]);
        }

        return AccountResource::make($account);
    }
}
