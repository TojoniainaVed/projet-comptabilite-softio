<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountingDefault;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Comptes par défaut de l'entreprise. Un champ vide signifie « automatique » :
 * le premier compte actif de la catégorie est alors utilisé (comportement historique).
 */
class AccountingDefaultController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorize('accounts.view');

        return response()->json(['data' => $this->payload(AccountingDefault::query()->first())]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorize('accounts.update');

        $rules = [];
        foreach (AccountingDefault::FIELDS as $field) {
            $rules[$field['column']] = ['nullable', 'integer'];
        }
        $data = $request->validate($rules);

        // Chaque compte doit appartenir à l'entreprise (filtre automatique), être actif, non regroupement et de type cohérent.
        foreach (AccountingDefault::FIELDS as $category => $field) {
            $id = $data[$field['column']] ?? null;
            if ($id === null) {
                continue;
            }

            $account = Account::query()->find($id);
            if ($account === null || ! $account->is_active || $account->is_group || $account->type !== $field['type']) {
                throw new BusinessRuleException(
                    "Le compte choisi pour « $category » est invalide : il doit être actif, de type {$field['type']} et ne pas être un compte de regroupement.",
                    'default_account_invalid',
                );
            }
        }

        $default = AccountingDefault::query()->first()
            ?? new AccountingDefault(['company_id' => $request->user()->company_id]);

        $default->fill($data)->save();
        $this->audit->log('accounting_defaults.updated', $default, ['fields' => array_keys($data)]);

        return response()->json(['data' => $this->payload($default)]);
    }

    /** @return array<string, int|null> */
    private function payload(?AccountingDefault $default): array
    {
        $payload = [];
        foreach (AccountingDefault::FIELDS as $field) {
            $payload[$field['column']] = $default?->{$field['column']};
        }

        return $payload;
    }
}
