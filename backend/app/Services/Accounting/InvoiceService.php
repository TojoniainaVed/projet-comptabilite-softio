<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Partner;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    public function __construct(
        private readonly JournalEntryService $entries,
        private readonly AccountResolver $resolver,
        private readonly AuditLogger $audit,
    ) {}

    /** @param  array<string, mixed>  $data */
    public function saveDraft(array $data, User $user, ?Invoice $invoice = null): Invoice
    {
        return DB::transaction(function () use ($data, $user, $invoice): Invoice {
            if ($invoice !== null && ! $invoice->isDraft()) {
                throw new BusinessRuleException('Seule une facture brouillon peut être modifiée.', 'invoice_not_draft');
            }

            $type = $invoice?->type ?? $data['type'];
            $this->assertPartner((int) $data['partner_id'], $type);
            $this->assertLineAccounts($data['lines']);

            $totals = InvoiceCalculator::compute($data['lines']);

            $attributes = [
                'partner_id' => $data['partner_id'],
                'supplier_reference' => $data['supplier_reference'] ?? null,
                'invoice_date' => $data['invoice_date'],
                'due_date' => $data['due_date'],
                'notes' => $data['notes'] ?? null,
                'subtotal' => Money::fromCents($totals['subtotal_cents']),
                'tax_total' => Money::fromCents($totals['tax_cents']),
                'total' => Money::fromCents($totals['total_cents']),
            ];

            if ($invoice === null) {
                $invoice = Invoice::create($attributes + [
                    'company_id' => $user->company_id,
                    'type' => $type,
                    'status' => Invoice::STATUS_DRAFT,
                    'currency' => $user->company->currency,
                    'created_by' => $user->id,
                ]);
            } else {
                $invoice->update($attributes);
                $invoice->lines()->delete();
            }

            foreach ($data['lines'] as $index => $line) {
                $invoice->lines()->create([
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tax_rate' => $line['tax_rate'] ?? 0,
                    'net_amount' => Money::fromCents($totals['lines'][$index]['net_cents']),
                    'tax_amount' => Money::fromCents($totals['lines'][$index]['tax_cents']),
                ]);
            }

            return $invoice->load('lines.account', 'partner');
        });
    }

    public function deleteDraft(Invoice $invoice): void
    {
        if (! $invoice->isDraft()) {
            throw new BusinessRuleException('Seule une facture brouillon peut être supprimée.', 'invoice_not_draft');
        }

        $invoice->delete();
    }

    /** Validation : génère et valide l'écriture comptable correspondante, de façon atomique. */
    public function post(Invoice $invoice, User $user): Invoice
    {
        return DB::transaction(function () use ($invoice, $user): Invoice {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isDraft()) {
                throw new BusinessRuleException('Seule une facture brouillon peut être validée.', 'invoice_not_draft');
            }

            $lines = $locked->lines()->get();
            if ($lines->isEmpty() || Money::toCents($locked->total) <= 0) {
                throw new BusinessRuleException('La facture doit avoir un montant positif.', 'invoice_empty');
            }

            $isCustomer = $locked->type === Invoice::TYPE_CUSTOMER;
            $journal = $this->resolver->journalByType($isCustomer ? 'sales' : 'purchases');
            $partner = Partner::query()->findOrFail($locked->partner_id);

            $entryLines = $isCustomer
                ? $this->customerEntryLines($locked, $lines)
                : $this->supplierEntryLines($locked, $lines);

            $entry = $this->entries->createDraft([
                'journal_id' => $journal->id,
                'entry_date' => $locked->invoice_date->toDateString(),
                'description' => ($isCustomer ? 'Facture client — ' : 'Facture fournisseur — ').$partner->name,
                'lines' => $entryLines,
            ], $user, 'invoice', $locked->id);

            $entry = $this->entries->post($entry, $user);

            $locked->forceFill([
                'status' => Invoice::STATUS_POSTED,
                'number' => $entry->reference,
                'journal_entry_id' => $entry->id,
                'posted_at' => now(),
            ])->save();

            $this->audit->log('invoice.posted', $locked, [
                'number' => $locked->number,
                'total' => $locked->total,
            ], $user);

            return $locked->load('lines.account', 'partner');
        });
    }

    /** Annulation d'une facture validée, sans paiement : contrepassation de l'écriture. */
    public function cancel(Invoice $invoice, User $user, ?string $reason = null): Invoice
    {
        return DB::transaction(function () use ($invoice, $user, $reason): Invoice {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status !== Invoice::STATUS_POSTED) {
                throw new BusinessRuleException('Seule une facture validée peut être annulée.', 'invoice_not_cancellable');
            }
            if (Money::toCents($locked->amount_paid) > 0) {
                throw new BusinessRuleException('Une facture déjà payée (même partiellement) ne peut pas être annulée.', 'invoice_has_payments');
            }

            $entry = JournalEntry::query()->findOrFail($locked->journal_entry_id);
            $this->entries->reverse($entry, $user, $reason, fromDocument: true);

            $locked->update(['status' => Invoice::STATUS_CANCELLED]);
            $this->audit->log('invoice.cancelled', $locked, ['number' => $locked->number, 'reason' => $reason], $user);

            return $locked->load('lines.account', 'partner');
        });
    }

    /** Débit client (TTC) / crédit produits (HT) + TVA collectée. */
    private function customerEntryLines(Invoice $invoice, $lines): array
    {
        $result = [[
            'account_id' => $this->resolver->byCategory('receivable')->id,
            'label' => 'Client',
            'debit' => $invoice->total,
            'credit' => 0,
        ]];

        foreach ($lines as $line) {
            $result[] = ['account_id' => $line->account_id, 'label' => $line->description, 'debit' => 0, 'credit' => $line->net_amount];
        }

        if (Money::toCents($invoice->tax_total) > 0) {
            $result[] = [
                'account_id' => $this->resolver->byCategory('vat_collected')->id,
                'label' => 'TVA collectée',
                'debit' => 0,
                'credit' => $invoice->tax_total,
            ];
        }

        return $result;
    }

    /** Débit charges (HT) + TVA déductible / crédit fournisseur (TTC). */
    private function supplierEntryLines(Invoice $invoice, $lines): array
    {
        $result = [];
        foreach ($lines as $line) {
            $result[] = ['account_id' => $line->account_id, 'label' => $line->description, 'debit' => $line->net_amount, 'credit' => 0];
        }

        if (Money::toCents($invoice->tax_total) > 0) {
            $result[] = [
                'account_id' => $this->resolver->byCategory('vat_deductible')->id,
                'label' => 'TVA déductible',
                'debit' => $invoice->tax_total,
                'credit' => 0,
            ];
        }

        $result[] = [
            'account_id' => $this->resolver->byCategory('payable')->id,
            'label' => 'Fournisseur',
            'debit' => 0,
            'credit' => $invoice->total,
        ];

        return $result;
    }

    private function assertPartner(int $partnerId, string $invoiceType): void
    {
        $expected = $invoiceType === Invoice::TYPE_CUSTOMER ? Partner::TYPE_CUSTOMER : Partner::TYPE_SUPPLIER;
        $partner = Partner::query()->whereKey($partnerId)->first();

        if ($partner === null || $partner->type !== $expected || ! $partner->is_active) {
            throw new BusinessRuleException('Le partenaire est invalide pour ce type de facture.', 'invalid_partner');
        }
    }

    /** @param  list<array<string, mixed>>  $lines */
    private function assertLineAccounts(array $lines): void
    {
        $ids = collect($lines)->pluck('account_id')->unique();

       if (
    Account::query()
        ->whereIn('id', $ids)
        ->where('is_active', true)
        ->where('is_group', false)
        ->count() !== $ids->count()
) {
    throw new BusinessRuleException(
        'Un des comptes de ligne est invalide, inactif ou réservé au regroupement.',
        'invalid_account'
    );
}
    }
}
