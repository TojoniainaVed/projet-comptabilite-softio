<?php

namespace App\Policies;

use App\Models\CreditNote;
use App\Models\User;

class CreditNotePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('credit_notes.view');
    }

    public function view(User $user, CreditNote $creditNote): bool
    {
        return $user->hasPermission('credit_notes.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('credit_notes.create');
    }

    public function update(User $user, CreditNote $creditNote): bool
    {
        return $user->hasPermission('credit_notes.update');
    }

    public function delete(User $user, CreditNote $creditNote): bool
    {
        return $user->hasPermission('credit_notes.update');
    }

    public function post(User $user, CreditNote $creditNote): bool
    {
        return $user->hasPermission('credit_notes.validate');
    }

    public function cancel(User $user, CreditNote $creditNote): bool
    {
        return $user->hasPermission('credit_notes.cancel');
    }
}
