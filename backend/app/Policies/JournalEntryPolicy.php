<?php

namespace App\Policies;

use App\Models\JournalEntry;
use App\Models\User;

class JournalEntryPolicy
{
    // Les policies ne vérifient que les permissions. Les règles d'état (brouillon, validée...) sont
    // appliquées par les services, qui répondent par une erreur métier 422 explicite.

    public function viewAny(User $user): bool
    {
        return $user->hasPermission('entries.view');
    }

    public function view(User $user, JournalEntry $entry): bool
    {
        return $user->hasPermission('entries.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('entries.create');
    }

    public function update(User $user, JournalEntry $entry): bool
    {
        return $user->hasPermission('entries.update');
    }

    public function delete(User $user, JournalEntry $entry): bool
    {
        return $user->hasPermission('entries.update');
    }

    public function post(User $user, JournalEntry $entry): bool
    {
        return $user->hasPermission('entries.validate');
    }

    public function reverse(User $user, JournalEntry $entry): bool
    {
        return $user->hasPermission('entries.cancel');
    }

    public function export(User $user): bool
    {
        return $user->hasPermission('entries.export');
    }
}
