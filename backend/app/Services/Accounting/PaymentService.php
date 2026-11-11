<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\Money;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private readonly JournalEntryService $entries,
        private readonly AccountResolver $resolver,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Enregistre un paiement de façon idempotente.
     *
     * @param  array{amount:mixed, paid_on:string, method:string, treasury_account_id:int, reference?:?string}  $data
     * @return array{0: Payment, 1: bool} le paiement et un booléen « créé maintenant »
     */
    public function register(Invoice $invoice, array $data, string $idempotencyKey, User $user): array
    {
        $existing = Payment::query()
    ->where('company_id', $user->company_id)
    ->where('idempotency_key', $idempotencyKey)
    ->first();
        if ($existing !== null) {
            return [$this->replay($existing, $invoice), false];
        }

        try {
            return [$this->create($invoice, $data, $idempotencyKey, $user), true];
        }catch (UniqueConstraintViolationException) {
    // Deux requêtes simultanées avec la même clé :
    // la seconde retrouve le paiement de la première.
    $existing = Payment::query()
        ->where('company_id', $user->company_id)
        ->where('idempotency_key', $idempotencyKey)
        ->firstOrFail();

    return [$this->replay($existing, $invoice), false];
}
    }

    private function replay(Payment $existing, Invoice $invoice): Payment
    {
        if ($existing->invoice_id !== $invoice->id) {
            throw new BusinessRuleException('Cette clé d\'idempotence a déjà servi pour une autre facture.', 'idempotency_conflict');
        }

        return $existing->load('invoice', 'treasuryAccount');
    }

    /** @param  array<string, mixed>  $data */
    private function create(Invoice $invoice, array $data, string $idempotencyKey, User $user): Payment
    {
        return DB::transaction(function () use ($invoice, $data, $idempotencyKey, $user): Payment {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status !== Invoice::STATUS_POSTED) {
                throw new BusinessRuleException('Seule une facture validée et non soldée peut recevoir un paiement.', 'invoice_not_payable');
            }

            $amount = Money::toCents($data['amount']);
            if ($amount <= 0) {
                throw new BusinessRuleException('Le montant doit être positif.', 'invalid_amount');
            }
            if ($amount > $locked->amountDueCents()) {
                throw new BusinessRuleException(
                    'Le paiement dépasse le solde dû ('.Money::fromCents($locked->amountDueCents()).').',
                    'payment_exceeds_due'
                );
            }

           $treasury = Account::query()
    ->whereKey($data['treasury_account_id'])
    ->whereIn('category', ['bank', 'cash'])
    ->where('is_active', true)
    ->where('is_group', false)
    ->first();
            if ($treasury === null) {
                throw new BusinessRuleException('Le compte de trésorerie doit être un compte banque ou caisse actif.', 'invalid_treasury_account');
            }

            $payment = Payment::create([
                'company_id' => $user->company_id,
                'invoice_id' => $locked->id,
                'treasury_account_id' => $treasury->id,
                'amount' => Money::fromCents($amount),
                'paid_on' => $data['paid_on'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'idempotency_key' => $idempotencyKey,
                'created_by' => $user->id,
            ]);

            $isCustomer = $locked->type === Invoice::TYPE_CUSTOMER;
            $counterpart = $this->resolver->byCategory($isCustomer ? 'receivable' : 'payable');
            $amountStr = Money::fromCents($amount);

            $entry = $this->entries->createDraft([
                'journal_id' => $this->resolver->treasuryJournal($treasury)->id,
                'entry_date' => $data['paid_on'],
                'description' => ($isCustomer ? 'Encaissement' : 'Décaissement').' facture '.$locked->number,
                'lines' => $isCustomer
                    ? [
                        ['account_id' => $treasury->id, 'label' => $locked->number, 'debit' => $amountStr, 'credit' => 0],
                        ['account_id' => $counterpart->id, 'label' => $locked->number, 'debit' => 0, 'credit' => $amountStr],
                    ]
                    : [
                        ['account_id' => $counterpart->id, 'label' => $locked->number, 'debit' => $amountStr, 'credit' => 0],
                        ['account_id' => $treasury->id, 'label' => $locked->number, 'debit' => 0, 'credit' => $amountStr],
                    ],
            ], $user, 'payment', $payment->id);

            $entry = $this->entries->post($entry, $user);
            $payment->update(['journal_entry_id' => $entry->id]);

            $paid = Money::toCents($locked->amount_paid) + $amount;
            $locked->update([
                'amount_paid' => Money::fromCents($paid),
                'status' => $paid === Money::toCents($locked->total) ? Invoice::STATUS_PAID : Invoice::STATUS_POSTED,
            ]);

            $this->audit->log('payment.created', $payment, [
                'invoice' => $locked->number,
                'amount' => $amountStr,
            ], $user);

            return $payment->load('invoice', 'treasuryAccount');
        });
    }
}
