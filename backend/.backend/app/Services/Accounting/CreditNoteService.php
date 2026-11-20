
<?php

namespace App\Services\Accounting;

use App\Exceptions\BusinessRuleException;
use App\Models\CreditNote;
use App\Models\CreditNoteLine;
use App\Models\Invoice;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreditNoteService
{
    public function saveDraft(
        Invoice $invoice,
        array $data,
        ?CreditNote $creditNote = null,
        ?int $userId = null,
    ): CreditNote {
        return DB::transaction(function () use ($invoice, $data, $creditNote, $userId) {
            // Verrouiller la facture pour éviter les validations concurrentes.
            $invoice = Invoice::query()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($invoice->status, [
                Invoice::STATUS_POSTED,
                Invoice::STATUS_PAID,
            ], true)) {
                throw new BusinessRuleException(
                    'Un avoir ne peut être créé que pour une facture validée.'
                );
            }

            if ($creditNote) {
                $creditNote = CreditNote::query()
                    ->whereKey($creditNote->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($creditNote->invoice_id !== $invoice->id) {
                    throw new BusinessRuleException(
                        'Cet avoir ne correspond pas à la facture sélectionnée.'
                    );
                }

                if (! $creditNote->isDraft()) {
                    throw new BusinessRuleException(
                        'Seul un avoir en brouillon peut être modifié.'
                    );
                }
            }

            $partner = $invoice->partner;

            if (! $partner || ! $partner->is_active) {
                throw new BusinessRuleException(
                    'Le tiers associé à cette facture est indisponible.'
                );
            }

            $expectedPartnerType = $invoice->type === Invoice::TYPE_CUSTOMER
                ? 'customer'
                : 'supplier';

            if ($partner->type !== $expectedPartnerType) {
                throw new BusinessRuleException(
                    'Le type du tiers ne correspond pas à celui de la facture.'
                );
            }

            $invoiceLines = $invoice->lines()->get()->keyBy('id');

            if ($invoiceLines->isEmpty()) {
                throw new BusinessRuleException(
                    'La facture ne contient aucune ligne.'
                );
            }

            if (empty($data['lines']) || ! is_array($data['lines'])) {
                throw ValidationException::withMessages([
                    'lines' => ['Ajoutez au moins une ligne à cet avoir.'],
                ]);
            }

            // Les autres avoirs non annulés réservent déjà une partie
            // des quantités et du montant de la facture.
            $otherCreditNotes = CreditNote::query()
                ->where('invoice_id', $invoice->id)
                ->where('status', '<>', CreditNote::STATUS_CANCELLED)
                ->when(
                    $creditNote,
                    fn ($query) => $query->where('id', '<>', $creditNote->id)
                )
                ->with('lines')
                ->lockForUpdate()
                ->get();

            $reservedQuantities = [];
            $reservedTotalCents = 0;

            foreach ($otherCreditNotes as $otherNote) {
                $reservedTotalCents += Money::toCents($otherNote->total);

                foreach ($otherNote->lines as $line) {
                    if ($line->invoice_line_id === null) {
                        continue;
                    }

                    $lineId = $line->invoice_line_id;

                    $reservedQuantities[$lineId] =
                        ($reservedQuantities[$lineId] ?? 0)
                        + self::quantityToHundredths($line->quantity);
                }
            }

            $calculatorLines = [];
            $validatedLines = [];
            $requestedQuantities = [];

            foreach ($data['lines'] as $index => $lineData) {
                $invoiceLineId = (int) ($lineData['invoice_line_id'] ?? 0);
                $originalLine = $invoiceLines->get($invoiceLineId);

                if (! $originalLine) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.invoice_line_id" => [
                            'Cette ligne ne fait pas partie de la facture sélectionnée.',
                        ],
                    ]);
                }

                $quantity = (float) ($lineData['quantity'] ?? 0);
                $unitPrice = (float) ($lineData['unit_price'] ?? 0);
                $taxRate = (float) ($lineData['tax_rate'] ?? 0);

                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.quantity" => [
                            'La quantité doit être supérieure à zéro.',
                        ],
                    ]);
                }

                if ($unitPrice < 0 || $unitPrice > (float) $originalLine->unit_price) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.unit_price" => [
                            'Le prix unitaire doit être positif et ne peut pas dépasser celui de la facture.',
                        ],
                    ]);
                }

                if (round($taxRate * 100) !== round((float) $originalLine->tax_rate * 100)) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.tax_rate" => [
                            'Le taux de taxe doit correspondre à celui de la ligne d’origine.',
                        ],
                    ]);
                }

                $quantityHundredths = self::quantityToHundredths($quantity);

                $requestedQuantities[$invoiceLineId] =
                    ($requestedQuantities[$invoiceLineId] ?? 0)
                    + $quantityHundredths;

                $availableQuantity = self::quantityToHundredths(
                    $originalLine->quantity
                ) - ($reservedQuantities[$invoiceLineId] ?? 0);

                if ($requestedQuantities[$invoiceLineId] > $availableQuantity) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.quantity" => [
                            'La quantité demandée dépasse la quantité encore disponible sur la facture.',
                        ],
                    ]);
                }

                $calculatorLines[] = [
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'tax_rate' => $taxRate,
                ];

                $validatedLines[] = [
                    'invoice_line_id' => $invoiceLineId,
                    'account_id' => $originalLine->account_id,
                    'description' => $lineData['description'] ?? $originalLine->description,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'tax_rate' => $taxRate,
                ];
            }

            $calculation = InvoiceCalculator::compute($calculatorLines);

            $subtotalCents = $calculation['subtotal_cents'];
            $taxCents = $calculation['tax_cents'];
            $totalCents = $calculation['total_cents'];

            if ($totalCents <= 0) {
                throw new BusinessRuleException(
                    'Le montant total de l’avoir doit être supérieur à zéro.'
                );
            }

            $invoiceTotalCents = Money::toCents($invoice->total);

            if ($reservedTotalCents + $totalCents > $invoiceTotalCents) {
                throw new BusinessRuleException(
                    'Le montant cumulé des avoirs dépasse le montant de la facture.'
                );
            }

            $type = $invoice->type === Invoice::TYPE_CUSTOMER
                ? CreditNote::TYPE_CUSTOMER
                : CreditNote::TYPE_SUPPLIER;

            $creditNote ??= new CreditNote();

            $creditNote->fill([
                'company_id' => $invoice->company_id,
                'invoice_id' => $invoice->id,
                'partner_id' => $invoice->partner_id,
                'type' => $type,
                'credit_note_date' => $data['credit_note_date'],
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'currency' => $invoice->currency,
                'subtotal' => Money::fromCents($subtotalCents),
                'tax_total' => Money::fromCents($taxCents),
                'total' => Money::fromCents($totalCents),
                'status' => CreditNote::STATUS_DRAFT,
                'created_by' => $creditNote->exists
                    ? $creditNote->created_by
                    : $userId,
            ]);

            $creditNote->save();

            $creditNote->lines()->delete();

            foreach ($validatedLines as $index => $line) {
                $computedLine = $calculation['lines'][$index];

                $creditNote->lines()->create([
                    ...$line,
                    'net_amount' => Money::fromCents($computedLine['net_cents']),
                    'tax_amount' => Money::fromCents($computedLine['tax_cents']),
                ]);
            }

            return $creditNote->load('invoice', 'partner', 'lines.account');
        });
    }

    private static function quantityToHundredths(string|int|float|null $quantity): int
    {
        return (int) round((float) $quantity * 100);
    }
}
