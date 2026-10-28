<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Violation d'une règle métier (écriture déséquilibrée, paiement excessif, etc.).
 * Rendue en HTTP 422 avec un code stable (voir bootstrap/app.php).
 */
class BusinessRuleException extends RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode = 'business_rule_violation')
    {
        parent::__construct($message);
    }
}
