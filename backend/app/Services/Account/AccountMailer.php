<?php

namespace App\Services\Account;

use App\Models\User;
use Illuminate\Support\Facades\Mail;

/**
 * Envoi des e-mails transactionnels (texte brut, sans pièce jointe). Isolé dans un service pour pouvoir
 * être remplacé dans les tests et pour garder les contrôleurs sans détail d'envoi.
 */
class AccountMailer
{
    public function sendVerification(User $user, string $url): void
    {
        $app = (string) config('app.name');
        $this->send($user, "Confirmez votre adresse e-mail — {$app}", implode("\n\n", [
            "Bonjour {$user->name},",
            "Bienvenue sur {$app}. Pour activer votre compte, confirmez votre adresse e-mail en ouvrant ce lien (valable 48 heures) :\n{$url}",
            "Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.",
        ]));
    }

    public function sendPasswordReset(User $user, string $url): void
    {
        $app = (string) config('app.name');
        $minutes = (int) config('auth.passwords.users.expire');
        $this->send($user, "Réinitialisation de votre mot de passe — {$app}", implode("\n\n", [
            "Bonjour {$user->name},",
            "Une réinitialisation du mot de passe de votre compte a été demandée. Choisissez un nouveau mot de passe via ce lien (valable {$minutes} minutes) :\n{$url}",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
        ]));
    }

    private function send(User $user, string $subject, string $body): void
    {
        Mail::raw($body, function ($message) use ($user, $subject): void {
            $message->to($user->email, $user->name)->subject($subject);
        });
    }
}
