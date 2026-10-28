<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Point d'entrée unique du journal d'audit.
 * Les clés sensibles (mot de passe, jeton, secret) sont systématiquement masquées.
 */
class AuditLogger
{
    private const SENSITIVE_KEYS = ['password', 'password_confirmation', 'current_password', 'token', 'secret', 'api_key', 'authorization'];

    /** @param array<string, mixed> $metadata */
    public function log(string $action, ?Model $subject = null, array $metadata = [], ?User $actor = null): AuditLog
    {
        $request = request();
        $actor ??= $request->user();

        return AuditLog::create([
            'company_id' => $this->resolveCompanyId($subject, $actor),
            'user_id' => $actor?->getKey(),
            'action' => $action,
            'subject_type' => $subject ? Str::snake(class_basename($subject)) : null,
            'subject_id' => $subject?->getKey(),
            'metadata' => $metadata === [] ? null : $this->redact($metadata),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() !== null ? Str::limit($request->userAgent(), 250, '') : null,
        ]);
    }

    private function resolveCompanyId(?Model $subject, ?User $actor): ?int
    {
        if ($subject instanceof Company) {
            return $subject->getKey();
        }

        return $subject?->getAttribute('company_id') ?? $actor?->company_id;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array(Str::lower((string) $key), self::SENSITIVE_KEYS, true)) {
                $data[$key] = '[masqué]';
            } elseif (is_array($value)) {
                $data[$key] = $this->redact($value);
            }
        }

        return $data;
    }
}
