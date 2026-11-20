<?php

namespace App\Services\Softio;

use App\Exceptions\BusinessRuleException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Appels de serveur à serveur vers l'API Softio, authentifiés par le secret partagé.
 */
class SoftioClient
{
    /**
     * Échange le code reçu dans l'URL contre les infos de l'utilisateur.
     *
     * @return array<string, mixed>
     */
    public function echanger(string $code): array
    {
        $response = $this->post('/sso/echanger', ['code' => $code]);

        if ($response->status() === 403) {
            throw new BusinessRuleException(
                "Votre abonnement au module Comptabilité n'est pas actif. Renouvelez-le depuis Softio.",
                'softio_access_inactive',
            );
        }

        if ($response->status() === 401) {
            throw new BusinessRuleException(
                'La connexion avec Softio est mal configurée (clé secrète différente). Contactez l\'administrateur.',
                'softio_bad_secret',
            );
        }

        if ($response->serverError()) {
            Log::error('Erreur de Softio pendant la connexion.', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);

            throw new BusinessRuleException(
                'Softio a rencontré une erreur. Réessayez dans un instant.',
                'softio_error',
            );
        }

        if (! $response->successful()) {
            throw new BusinessRuleException(
                'Ce lien de connexion est invalide ou a expiré. Rouvrez le module depuis Softio.',
                'softio_code_invalid',
            );
        }

        return $response->json();
    }

    /**
     * L'utilisateur a-t-il toujours accès au module ? null si Softio ne répond pas.
     */
    public function accesActif(int $softioUserId): ?bool
    {
        try {
            $response = $this->post('/sso/verifier', [
                'user_id' => $softioUserId,
                'module_id' => config('softio.sso.module_id'),
            ]);
        } catch (BusinessRuleException) {
            return null;
        }

        if ($response->status() === 404) {
            return false;
        }

        return $response->successful() ? (bool) $response->json('acces.actif') : null;
    }

    private function post(string $chemin, array $donnees): Response
    {
        $secret = (string) config('softio.sso.secret');
        if ($secret === '') {
            throw new BusinessRuleException('La connexion depuis Softio n\'est pas configurée.', 'softio_not_configured');
        }

        try {
            return Http::acceptJson()
                ->timeout(10)
                ->withHeaders(['X-Sso-Secret' => $secret])
                ->post(config('softio.sso.api_url') . $chemin, $donnees);
        } catch (ConnectionException) {
            throw new BusinessRuleException('Softio est injoignable pour le moment. Réessayez dans un instant.', 'softio_unreachable');
        }
    }
}
