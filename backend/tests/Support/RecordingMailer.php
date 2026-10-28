<?php

namespace Tests\Support;

use App\Models\User;
use App\Services\Account\AccountMailer;

/** Mailer de test : mémorise les liens au lieu d'envoyer quoi que ce soit. */
class RecordingMailer extends AccountMailer
{
    /** @var list<string> */
    public array $verificationUrls = [];

    /** @var list<string> */
    public array $resetUrls = [];

    public function sendVerification(User $user, string $url): void
    {
        $this->verificationUrls[] = $url;
    }

    public function sendPasswordReset(User $user, string $url): void
    {
        $this->resetUrls[] = $url;
    }
}
