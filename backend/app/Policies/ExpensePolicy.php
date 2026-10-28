<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;

class ExpensePolicy
{
    // Les policies ne vérifient que les permissions. Les règles d'état (brouillon, validée...) sont
    // appliquées par les services, qui répondent par une erreur métier 422 explicite.

    public function viewAny(User $user): bool
    {
        return $user->hasPermission('expenses.view');
    }

    public function view(User $user, Expense $expense): bool
    {
        return $user->hasPermission('expenses.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('expenses.create');
    }

    public function update(User $user, Expense $expense): bool
    {
        return $user->hasPermission('expenses.update');
    }

    public function delete(User $user, Expense $expense): bool
    {
        return $user->hasPermission('expenses.update');
    }

    public function post(User $user, Expense $expense): bool
    {
        return $user->hasPermission('expenses.validate');
    }
}
