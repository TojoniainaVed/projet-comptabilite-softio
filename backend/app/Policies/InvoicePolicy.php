<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    // Les policies ne vérifient que les permissions. Les règles d'état (brouillon, validée...) sont
    // appliquées par les services, qui répondent par une erreur métier 422 explicite.

    public function viewAny(User $user): bool
    {
        return $user->hasPermission('invoices.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('invoices.create');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.update');
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.update');
    }

    public function post(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.validate');
    }

    public function cancel(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.cancel');
    }

    public function pay(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('payments.create');
    }
}
