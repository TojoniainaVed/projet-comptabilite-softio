<?php

namespace App\Http\Requests;

use App\Models\Account;
use App\Models\Expense;
use App\Models\InvoiceLine;
use App\Models\JournalEntryLine;
use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = $this->user()->company_id;
        $account = $this->route('account');

        return [
            'code' => [
                'required',
                'string',
                'max:20',
                'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('accounts', 'code')
                    ->where('company_id', $companyId)
                    ->ignore($account?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(Account::TYPES)],
            'category' => ['nullable', Rule::in(Account::CATEGORIES)],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('accounts', 'id')->where(
                    fn ($query) => $query
                        ->where('company_id', $companyId)
                        ->where('is_group', true)
                ),
            ],
            'is_group' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $account = $this->route('account');

            if (!$account instanceof Account) {
                $account = null;
            }

            $isGroup = $this->has('is_group')
                ? $this->boolean('is_group')
                : ($account?->is_group ?? false);

            $type = $this->input('type', $account?->type);

            $category = $this->input(
                'category',
                $account?->category
            );

            // Un compte de regroupement ne reçoit pas de catégorie fonctionnelle.
            if ($isGroup && $category !== null && $category !== '') {
                $validator->errors()->add(
                    'category',
                    'Un compte de regroupement ne peut pas avoir de catégorie fonctionnelle.'
                );
            }

            if (!$account) {
                return;
            }

            // Un compte utilisé dans la comptabilité ne peut pas devenir un regroupement.
            if ($isGroup && $this->accountHasAccountingUsage($account)) {
                $validator->errors()->add(
                    'is_group',
                    'Ce compte est déjà utilisé dans la comptabilité et ne peut pas devenir un compte de regroupement.'
                );
            }

            // Un compte possédant des sous-comptes doit rester un regroupement.
            if (!$isGroup && $account->children()->exists()) {
                $validator->errors()->add(
                    'is_group',
                    'Ce compte possède des sous-comptes et doit rester un compte de regroupement.'
                );
            }

            // Éviter de modifier la classe comptable d'un compte déjà utilisé.
            if (
                $type !== $account->type
                && $this->accountHasAccountingUsage($account)
            ) {
                $validator->errors()->add(
                    'type',
                    'Le type comptable ne peut pas être modifié car ce compte est déjà utilisé.'
                );
            }

            // Vérification du compte parent et des boucles hiérarchiques.
            $parentId = $this->input(
                'parent_id',
                $account->parent_id
            );

            if (!$parentId) {
                return;
            }

            $parent = Account::query()->find($parentId);

            if (!$parent) {
                return;
            }

            if ($parent->type !== $type) {
                $validator->errors()->add(
                    'parent_id',
                    'Le compte parent doit avoir le même type comptable.'
                );
            }

            $cursor = $parent;
            $visited = [];

            while ($cursor) {
                if ($cursor->id === $account->id) {
                    $validator->errors()->add(
                        'parent_id',
                        'Cette relation créerait une boucle dans la hiérarchie.'
                    );

                    break;
                }

                if (isset($visited[$cursor->id])) {
                    break;
                }

                $visited[$cursor->id] = true;

                $cursor = $cursor->parent_id
                    ? Account::query()->find($cursor->parent_id)
                    : null;
            }
        });
    }

    private function accountHasAccountingUsage(Account $account): bool
    {
        return JournalEntryLine::query()
            ->where('account_id', $account->id)
            ->exists()

            || InvoiceLine::query()
                ->where('account_id', $account->id)
                ->exists()

            || Expense::query()
                ->where(function ($query) use ($account): void {
                    $query->where('account_id', $account->id)
                        ->orWhere('paid_from_account_id', $account->id);
                })
                ->exists()

            || Payment::query()
                ->where('treasury_account_id', $account->id)
                ->exists();
    }
}