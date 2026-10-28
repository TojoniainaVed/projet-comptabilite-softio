<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Models\User;
use App\Services\Admin\SettingsService;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

/**
 * Création / modification d'utilisateur.
 * - Super administrateur : choisit rôle et entreprise (rôle « plateforme » ⇒ aucune entreprise).
 * - Administrateur d'entreprise : ne crée que des utilisateurs de SA propre entreprise, avec un rôle d'entreprise.
 */
class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        $target = $this->route('user');
        $creating = $this->isMethod('POST');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($target?->id)],
            'password' => [
                $creating ? 'required' : 'nullable',
                'string',
                Password::min(app(SettingsService::class)->passwordMinLength())->mixedCase()->numbers(),
            ],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var User $actor */
            $actor = $this->user();
            $role = Role::query()->findOrFail($this->integer('role_id'));

            if ($actor->isPlatformAdmin()) {
                if ($role->scope === PermissionCatalog::COMPANY && $this->input('company_id') === null) {
                    $validator->errors()->add('company_id', 'Une entreprise est requise pour ce rôle.');
                }
                if ($role->scope === PermissionCatalog::PLATFORM && $this->input('company_id') !== null) {
                    $validator->errors()->add('company_id', 'Un compte de plateforme ne peut pas être rattaché à une entreprise.');
                }

                return;
            }

            if ($role->scope !== PermissionCatalog::COMPANY) {
                $validator->errors()->add('role_id', 'Ce rôle ne peut pas être attribué.');
            }
        }];
    }

    /**
     * Données prêtes à enregistrer : l'entreprise d'un administrateur d'entreprise est imposée côté serveur.
     *
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $data = $this->safe()->only(['name', 'email', 'password', 'role_id', 'company_id']);
        $actor = $this->user();

        if (! $actor->isPlatformAdmin()) {
            $data['company_id'] = $actor->company_id;
        }
        if (empty($data['password'])) {
            unset($data['password']);
        }

        return $data;
    }
}
