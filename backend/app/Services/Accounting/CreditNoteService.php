<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\Account;
use App\Models\CreditNote;
use App\Models\CreditNoteLine;
use App\Models\Invoice;
use App\Models\Partner;
use App\Models\User;
use App\Support\Money;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

class CreditNoteService
{
    public function __construct(
        private readonly JournalEntryService $entries,
        private readonly AccountResolver $resolver,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Crée un avoir brouillon ou modifie un brouillon existant.
     *
     * Les montants sont toujours recalculés côté serveur.
     *
     * @param array<string, mixed> $data
     */
    public function saveDraft(
        Invoice $invoice,
        array $data,
        User $user,
        ?CreditNote $creditNote = null
    ): CreditNote {
        return DB::transaction(function () use (
            $invoice,
            $data,
            $user,
            $creditNote
        ): CreditNote {

            if ($user->company_id === null) {
                throw new BusinessRuleException(
                    'Aucune entreprise n’est associée à cet utilisateur.',
                    'company_required'
                );
            }

            $companyId = (int) $user->company_id;

            // Verrouillage de la facture pour éviter les modifications
            // concurrentes des quantités déjà couvertes par des avoirs.
            $lockedInvoice = Invoice::query()
                ->where('company_id', $companyId)
                ->whereKey($invoice->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $lockedInvoice->company_id !== $companyId) {
                throw new BusinessRuleException(
                    'La facture ne correspond pas à votre entreprise.',
                    'invoice_company_mismatch'
                );
            }

            if (
                ! in_array($lockedInvoice->status, [
                    Invoice::STATUS_POSTED,
                    Invoice::STATUS_PAID,
                ], true)
            ) {
                throw new BusinessRuleException(
                    'Un avoir ne peut être créé que sur une facture validée ou payée.',
                    'invoice_not_eligible'
                );
            }

            if (
                $lockedInvoice->type !== Invoice::TYPE_CUSTOMER
                && $lockedInvoice->type !== Invoice::TYPE_SUPPLIER
            ) {
                throw new BusinessRuleException(
                    'Le type de facture est invalide.',
                    'invalid_invoice_type'
                );
            }

            if (
                isset($data['invoice_id'])
                && (int) $data['invoice_id'] !== (int) $lockedInvoice->id
            ) {
                throw new BusinessRuleException(
                    'La facture transmise ne correspond pas à la facture sélectionnée.',
                    'invoice_mismatch'
                );
            }

            if (Money::toCents($lockedInvoice->total) <= 0) {
                throw new BusinessRuleException(
                    'La facture originale doit avoir un montant positif.',
                    'invoice_empty'
                );
            }

            // Vérification du partenaire et de son entreprise.
            $expectedPartnerType = $lockedInvoice->type === Invoice::TYPE_CUSTOMER
                ? Partner::TYPE_CUSTOMER
                : Partner::TYPE_SUPPLIER;

            $partner = Partner::query()
                ->where('company_id', $companyId)
                ->whereKey($lockedInvoice->partner_id)
                ->where('type', $expectedPartnerType)
                ->where('is_active', true)
                ->first();

            if ($partner === null) {
                throw new BusinessRuleException(
                    'Le partenaire de la facture est invalide ou inactif.',
                    'invalid_partner'
                );
            }

            // Si nous modifions un brouillon, nous vérifions son appartenance.
            if ($creditNote !== null) {
                $creditNote = CreditNote::query()
                    ->where('company_id', $companyId)
                    ->whereKey($creditNote->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();

                if (! $creditNote->isDraft()) {
                    throw new BusinessRuleException(
                        'Seul un avoir brouillon peut être modifié.',
                        'credit_note_not_draft'
                    );
                }

                if ((int) $creditNote->invoice_id !== (int) $lockedInvoice->id) {
                    throw new BusinessRuleException(
                        'Un avoir ne peut pas être déplacé vers une autre facture.',
                        'credit_note_invoice_mismatch'
                    );
                }
            }

            if (! isset($data['lines']) || ! is_array($data['lines']) || $data['lines'] === []) {
                throw new BusinessRuleException(
                    'Un avoir doit contenir au moins une ligne.',
                    'credit_note_empty'
                );
            }

            // Chargement des lignes de la facture originale.
            $invoiceLines = $lockedInvoice->lines()
                ->get()
                ->keyBy('id');

            // Quantités déjà réservées par les autres avoirs
            // de cette facture, brouillons compris.
            $reservedQuery = CreditNoteLine::query()
                ->join(
                    'credit_notes',
                    'credit_notes.id',
                    '=',
                    'credit_note_lines.credit_note_id'
                )
                ->where('credit_notes.company_id', $companyId)
                ->where('credit_notes.invoice_id', $lockedInvoice->id)
                ->where('credit_notes.status', '<>', CreditNote::STATUS_CANCELLED);

            if ($creditNote !== null) {
                $reservedQuery->where(
                    'credit_note_lines.credit_note_id',
                    '<>',
                    $creditNote->id
                );
            }

            $reservedQuantities = $reservedQuery
                ->select('credit_note_lines.invoice_line_id')
                ->selectRaw('SUM(credit_note_lines.quantity) AS reserved_quantity')
                ->groupBy('credit_note_lines.invoice_line_id')
                ->pluck(
                    'reserved_quantity',
                    'credit_note_lines.invoice_line_id'
                );

            $calculationLines = [];
            $validatedLines = [];
            $usedInvoiceLineIds = [];

            foreach ($data['lines'] as $line) {
                $invoiceLineId = (int) $line['invoice_line_id'];

                if (isset($usedInvoiceLineIds[$invoiceLineId])) {
                    throw new BusinessRuleException(
                        'Une même ligne de facture ne peut pas être ajoutée plusieurs fois.',
                        'duplicate_invoice_line'
                    );
                }

                $usedInvoiceLineIds[$invoiceLineId] = true;

                $invoiceLine = $invoiceLines->get($invoiceLineId);

                if ($invoiceLine === null) {
                    throw new BusinessRuleException(
                        'Une ligne sélectionnée ne fait pas partie de la facture originale.',
                        'invalid_invoice_line'
                    );
                }

                $quantityHundredths = self::quantityToHundredths(
                    $line['quantity']
                );

                $originalQuantityHundredths = self::quantityToHundredths(
                    $invoiceLine->quantity
                );

                $reservedHundredths = self::quantityToHundredths(
                    $reservedQuantities->get($invoiceLineId, 0)
                );

                if (
                    $quantityHundredths + $reservedHundredths
                    > $originalQuantityHundredths
                ) {
                    throw new BusinessRuleException(
                        'La quantité totale des avoirs dépasse la quantité de la facture originale.',
                        'credit_note_quantity_exceeded'
                    );
                }

                if (
                    Money::toCents($line['unit_price'])
                    > Money::toCents($invoiceLine->unit_price)
                ) {
                    throw new BusinessRuleException(
                        'Le prix unitaire de l’avoir ne peut pas dépasser celui de la facture originale.',
                        'credit_note_price_exceeded'
                    );
                }

                if (
                    Money::toCents($line['tax_rate'])
                    !== Money::toCents($invoiceLine->tax_rate)
                ) {
                    throw new BusinessRuleException(
                        'Le taux de TVA doit être identique à celui de la facture originale.',
                        'credit_note_tax_mismatch'
                    );
                }

                $description = ! empty($line['description'])
                    ? $line['description']
                    : $invoiceLine->description;

                $calculationLines[] = [
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tax_rate' => $line['tax_rate'],
                ];

                $validatedLines[] = [
                    'invoice_line_id' => $invoiceLine->id,
                    'account_id' => $invoiceLine->account_id,
                    'description' => $description,
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tax_rate' => $line['tax_rate'],
                ];
            }

            // Calcul fiable des montants.
            $totals = InvoiceCalculator::compute($calculationLines);

            if ($totals['total_cents'] <= 0) {
                throw new BusinessRuleException(
                    'Le montant total de l’avoir doit être positif.',
                    'credit_note_amount_invalid'
                );
            }

            $attributes = [
                'company_id' => $companyId,
                'invoice_id' => $lockedInvoice->id,
                'partner_id' => $partner->id,
                'type' => $lockedInvoice->type,
                'credit_note_date' => $data['credit_note_date'],
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'currency' => $lockedInvoice->currency,
                'subtotal' => Money::fromCents($totals['subtotal_cents']),
                'tax_total' => Money::fromCents($totals['tax_cents']),
                'total' => Money::fromCents($totals['total_cents']),
            ];

            if ($creditNote === null) {
                $creditNote = CreditNote::create($attributes + [
                    'status' => CreditNote::STATUS_DRAFT,
                    'created_by' => $user->id,
                ]);
            } else {
                $creditNote->update($attributes);
                $creditNote->lines()->delete();
            }

            foreach ($validatedLines as $index => $line) {
                $creditNote->lines()->create([
                    'invoice_line_id' => $line['invoice_line_id'],
                    'account_id' => $line['account_id'],
                    'description' => $line['description'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tax_rate' => $line['tax_rate'],
                    'net_amount' => Money::fromCents(
                        $totals['lines'][$index]['net_cents']
                    ),
                    'tax_amount' => Money::fromCents(
                        $totals['lines'][$index]['tax_cents']
                    ),
                ]);
            }

            return $creditNote->load(
                'invoice',
                'partner',
                'lines.account',
                'creator'
            );
        }, 3);
    }

    /**
     * Valide un avoir et génère son écriture comptable.
     */
    public function post(CreditNote $creditNote, User $user): CreditNote
    {
        return DB::transaction(function () use ($creditNote, $user): CreditNote {

            if ($user->company_id === null) {
                throw new BusinessRuleException(
                    'Aucune entreprise n’est associée à cet utilisateur.',
                    'company_required'
                );
            }

            $companyId = (int) $user->company_id;

            /*
             * Même ordre de verrouillage que saveDraft :
             * facture, puis avoir.
             */
            $invoice = Invoice::query()
                ->where('company_id', $companyId)
                ->whereKey($creditNote->invoice_id)
                ->lockForUpdate()
                ->firstOrFail();

            $locked = CreditNote::query()
                ->where('company_id', $companyId)
                ->whereKey($creditNote->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (! $locked->isDraft()) {
                throw new BusinessRuleException(
                    'Seul un avoir brouillon peut être validé.',
                    'credit_note_not_draft'
                );
            }

            if ((int) $locked->invoice_id !== (int) $invoice->id) {
                throw new BusinessRuleException(
                    'La facture associée à cet avoir est invalide.',
                    'credit_note_invoice_mismatch'
                );
            }

            if (
                ! in_array($invoice->status, [
                    Invoice::STATUS_POSTED,
                    Invoice::STATUS_PAID,
                ], true)
            ) {
                throw new BusinessRuleException(
                    'La facture originale doit être validée ou payée.',
                    'invoice_not_eligible'
                );
            }

            if (
                ! in_array($locked->type, [
                    CreditNote::TYPE_CUSTOMER,
                    CreditNote::TYPE_SUPPLIER,
                ], true)
                || $locked->type !== $invoice->type
            ) {
                throw new BusinessRuleException(
                    'Le type de l’avoir ne correspond pas à celui de la facture.',
                    'credit_note_type_mismatch'
                );
            }

            if ((int) $locked->partner_id !== (int) $invoice->partner_id) {
                throw new BusinessRuleException(
                    'Le partenaire de l’avoir ne correspond pas à celui de la facture.',
                    'credit_note_partner_mismatch'
                );
            }

            if ($locked->currency !== $invoice->currency) {
                throw new BusinessRuleException(
                    'La devise de l’avoir ne correspond pas à celle de la facture.',
                    'credit_note_currency_mismatch'
                );
            }

            $expectedPartnerType = $invoice->type === Invoice::TYPE_CUSTOMER
                ? Partner::TYPE_CUSTOMER
                : Partner::TYPE_SUPPLIER;

            $partner = Partner::query()
                ->where('company_id', $companyId)
                ->whereKey($invoice->partner_id)
                ->where('type', $expectedPartnerType)
                ->where('is_active', true)
                ->first();

            if ($partner === null) {
                throw new BusinessRuleException(
                    'Le partenaire associé à la facture est invalide ou inactif.',
                    'invalid_partner'
                );
            }

            $lines = $locked->lines()->get();

            if ($lines->isEmpty()) {
                throw new BusinessRuleException(
                    'Impossible de valider un avoir sans ligne.',
                    'credit_note_empty'
                );
            }

            /*
             * Recalcul des montants à partir des données enregistrées.
             * Les totaux stockés ne sont jamais considérés comme fiables
             * sans vérification.
             */
            $invoiceLines = $invoice->lines()
                ->get()
                ->keyBy('id');

            $calculationLines = [];
            $usedInvoiceLineIds = [];

            foreach ($lines as $line) {
                $invoiceLineId = (int) $line->invoice_line_id;

                if (
                    $line->invoice_line_id === null
                    || isset($usedInvoiceLineIds[$invoiceLineId])
                ) {
                    throw new BusinessRuleException(
                        'Une ligne de l’avoir est invalide ou utilisée plusieurs fois.',
                        'invalid_credit_note_line'
                    );
                }

                $usedInvoiceLineIds[$invoiceLineId] = true;

                $invoiceLine = $invoiceLines->get($invoiceLineId);

                if ($invoiceLine === null) {
                    throw new BusinessRuleException(
                        'Une ligne de l’avoir ne correspond plus à la facture originale.',
                        'invalid_invoice_line'
                    );
                }

                $quantityHundredths = self::quantityToHundredths($line->quantity);
                $originalQuantityHundredths = self::quantityToHundredths(
                    $invoiceLine->quantity
                );

                if ($quantityHundredths <= 0) {
                    throw new BusinessRuleException(
                        'La quantité d’une ligne d’avoir doit être positive.',
                        'invalid_credit_note_quantity'
                    );
                }

                // Vérification du prix et de la TVA par rapport à l'original.
                if (
                    Money::toCents($line->unit_price)
                    > Money::toCents($invoiceLine->unit_price)
                ) {
                    throw new BusinessRuleException(
                        'Le prix unitaire de l’avoir dépasse celui de la facture originale.',
                        'credit_note_price_exceeded'
                    );
                }

                if (
                    Money::toCents($line->tax_rate)
                    !== Money::toCents($invoiceLine->tax_rate)
                ) {
                    throw new BusinessRuleException(
                        'Le taux de TVA de l’avoir ne correspond pas à la facture originale.',
                        'credit_note_tax_mismatch'
                    );
                }

                if (
                    (int) $line->account_id !== (int) $invoiceLine->account_id
                ) {
                    throw new BusinessRuleException(
                        'Le compte comptable de la ligne ne correspond pas à celui de la facture originale.',
                        'credit_note_account_mismatch'
                    );
                }

                $calculationLines[] = [
                    'quantity' => $line->quantity,
                    'unit_price' => $line->unit_price,
                    'tax_rate' => $line->tax_rate,
                ];
            }

            /*
             * Les autres avoirs, brouillons compris, réservent déjà
             * une partie des quantités de la facture.
             */
            $reservedQuantities = CreditNoteLine::query()
                ->join(
                    'credit_notes',
                    'credit_notes.id',
                    '=',
                    'credit_note_lines.credit_note_id'
                )
                ->where('credit_notes.company_id', $companyId)
                ->where('credit_notes.invoice_id', $invoice->id)
                ->where('credit_notes.status', '<>', CreditNote::STATUS_CANCELLED)
                ->where('credit_note_lines.credit_note_id', '<>', $locked->id)
                ->select('credit_note_lines.invoice_line_id')
                ->selectRaw('SUM(credit_note_lines.quantity) AS reserved_quantity')
                ->groupBy('credit_note_lines.invoice_line_id')
                ->pluck(
                    'reserved_quantity',
                    'credit_note_lines.invoice_line_id'
                );

            foreach ($lines as $line) {
                $invoiceLineId = (int) $line->invoice_line_id;

                $invoiceLine = $invoiceLines->get($invoiceLineId);

                $reservedHundredths = self::quantityToHundredths(
                    $reservedQuantities->get($invoiceLineId, 0)
                );

                $currentHundredths = self::quantityToHundredths(
                    $line->quantity
                );

                $originalHundredths = self::quantityToHundredths(
                    $invoiceLine->quantity
                );

                if (
                    $currentHundredths + $reservedHundredths
                    > $originalHundredths
                ) {
                    throw new BusinessRuleException(
                        'La quantité totale des avoirs dépasse la quantité de la facture originale.',
                        'credit_note_quantity_exceeded'
                    );
                }
            }

            $totals = InvoiceCalculator::compute($calculationLines);

            if ($totals['total_cents'] <= 0) {
                throw new BusinessRuleException(
                    'Le montant total de l’avoir doit être positif.',
                    'credit_note_amount_invalid'
                );
            }

            // Vérification des montants de chaque ligne.
            foreach ($lines as $index => $line) {
                $expectedNet = $totals['lines'][$index]['net_cents'];
                $expectedTax = $totals['lines'][$index]['tax_cents'];

                if (
                    Money::toCents($line->net_amount) !== $expectedNet
                    || Money::toCents($line->tax_amount) !== $expectedTax
                ) {
                    throw new BusinessRuleException(
                        'Les montants enregistrés d’une ligne ne correspondent pas au calcul attendu.',
                        'credit_note_line_amount_mismatch'
                    );
                }
            }

            // Vérification des totaux généraux.
            if (
                Money::toCents($locked->subtotal) !== $totals['subtotal_cents']
                || Money::toCents($locked->tax_total) !== $totals['tax_cents']
                || Money::toCents($locked->total) !== $totals['total_cents']
            ) {
                throw new BusinessRuleException(
                    'Les totaux de l’avoir ne correspondent pas aux montants recalculés.',
                    'credit_note_total_mismatch'
                );
            }

            /*
             * Vérification explicite des comptes des lignes :
             * entreprise, activité et absence de compte de regroupement.
             */
            $accountIds = $lines->pluck('account_id')->unique()->values();

            $accounts = Account::query()
                ->where('company_id', $companyId)
                ->whereIn('id', $accountIds)
                ->where('is_active', true)
                ->where('is_group', false)
                ->get()
                ->keyBy('id');

            if ($accounts->count() !== $accountIds->count()) {
                throw new BusinessRuleException(
                    'Un compte de ligne est invalide, inactif ou appartient à une autre entreprise.',
                    'invalid_account'
                );
            }

            $isCustomer = $locked->type === CreditNote::TYPE_CUSTOMER;

            $journal = $this->resolver->journalByType(
                $isCustomer ? 'sales' : 'purchases'
            );

            if (
                (int) $journal->company_id !== $companyId
                || ! $journal->is_active
            ) {
                throw new BusinessRuleException(
                    'Le journal comptable est invalide ou appartient à une autre entreprise.',
                    'invalid_journal'
                );
            }

            $entryLines = [];

            if ($isCustomer) {
                // Avoir client :
                // débit produits, débit TVA collectée,
                // crédit créances clients.
                foreach ($lines as $line) {
                    if (Money::toCents($line->net_amount) <= 0) {
                        continue;
                    }

                    $entryLines[] = [
                        'account_id' => $line->account_id,
                        'label' => $line->description,
                        'debit' => $line->net_amount,
                        'credit' => 0,
                    ];
                }

                if ($totals['tax_cents'] > 0) {
                    $vatAccount = $this->accountForCategory(
                        'vat_collected',
                        $companyId
                    );

                    $entryLines[] = [
                        'account_id' => $vatAccount->id,
                        'label' => 'TVA collectée',
                        'debit' => Money::fromCents($totals['tax_cents']),
                        'credit' => 0,
                    ];
                }

                $receivableAccount = $this->accountForCategory(
                    'receivable',
                    $companyId
                );

                $entryLines[] = [
                    'account_id' => $receivableAccount->id,
                    'label' => 'Client',
                    'debit' => 0,
                    'credit' => Money::fromCents($totals['total_cents']),
                ];
            } else {
                // Avoir fournisseur :
                // débit dettes fournisseurs,
                // crédit charges et TVA déductible.
                $payableAccount = $this->accountForCategory(
                    'payable',
                    $companyId
                );

                $entryLines[] = [
                    'account_id' => $payableAccount->id,
                    'label' => 'Fournisseur',
                    'debit' => Money::fromCents($totals['total_cents']),
                    'credit' => 0,
                ];

                foreach ($lines as $line) {
                    if (Money::toCents($line->net_amount) <= 0) {
                        continue;
                    }

                    $entryLines[] = [
                        'account_id' => $line->account_id,
                        'label' => $line->description,
                        'debit' => 0,
                        'credit' => $line->net_amount,
                    ];
                }

                if ($totals['tax_cents'] > 0) {
                    $vatAccount = $this->accountForCategory(
                        'vat_deductible',
                        $companyId
                    );

                    $entryLines[] = [
                        'account_id' => $vatAccount->id,
                        'label' => 'TVA déductible',
                        'debit' => 0,
                        'credit' => Money::fromCents($totals['tax_cents']),
                    ];
                }
            }

            $entry = $this->entries->createDraft([
                'journal_id' => $journal->id,
                'entry_date' => $locked->credit_note_date->toDateString(),
                'description' => 'Validation de l’avoir lié à la facture '.$invoice->number,
                'lines' => $entryLines,
            ], $user, 'credit_note', $locked->id);

            // Le moteur comptable vérifie la partie double
            // et l'existence d'un exercice ouvert.
            $entry = $this->entries->post($entry, $user);

            $locked->update([
                'journal_entry_id' => $entry->id,
                'number' => $entry->reference,
                'status' => CreditNote::STATUS_POSTED,
                'posted_at' => now(),
            ]);

            $this->audit->log('credit_note.posted', $locked, [
                'number' => $locked->number,
                'total' => $locked->total,
                'invoice_id' => $locked->invoice_id,
                'journal_entry_id' => $entry->id,
            ], $user);

            return $locked->fresh([
                'invoice',
                'partner',
                'journalEntry',
                'lines.account',
                'creator',
            ]);
        }, 3);
    }

    /**
     * Récupère un compte technique et vérifie son entreprise.
     */
    private function accountForCategory(
        string $category,
        int $companyId
    ): Account {
        $account = $this->resolver->byCategory($category);

        if (
            (int) $account->company_id !== $companyId
            || ! $account->is_active
            || $account->is_group
        ) {
            throw new BusinessRuleException(
                'Le compte comptable de catégorie '.$category.' est invalide.',
                'invalid_account'
            );
        }

        return $account;
    }

    /**
     * Convertit une quantité à deux décimales en centièmes entiers.
     */
    private static function quantityToHundredths(mixed $quantity): int
    {
        return (int) round(((float) $quantity) * 100);
    }
}
