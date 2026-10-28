<?php

namespace App\Http\Requests;

use App\Models\Account;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AccountRequest extends FormRequest
{
    // L'autorisation est portée par les Gates/Policies appelées dans le contrôleur.
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => [
                'required', 'string', 'max:20', 'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique('accounts', 'code')
                    ->where('company_id', $this->user()->company_id)
                    ->ignore($this->route('account')?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(Account::TYPES)],
            'category' => ['nullable', Rule::in(Account::CATEGORIES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
