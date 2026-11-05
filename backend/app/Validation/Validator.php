<?php

namespace App\Validation;

use Illuminate\Validation\Validator as BaseValidator;

/**
 * Laravel 10 n'est plus maintenu : sa règle « email » accepte des retours à la ligne (CRLF) dans une
 * partie locale entre guillemets, ce qui permet d'injecter des en-têtes dans les e-mails (CVE-2026-48019).
 * On reprend le correctif de Laravel 12.60 en refusant tout caractère de contrôle.
 */
class Validator extends BaseValidator
{
    /**
     * @param  string  $attribute
     * @param  mixed  $value
     * @param  array<int, string>  $parameters
     */
    public function validateEmail($attribute, $value, $parameters)
    {
        if (is_string($value) && preg_match('/[\x00-\x1F\x7F]/', $value) === 1) {
            return false;
        }

        return parent::validateEmail($attribute, $value, $parameters);
    }
}
