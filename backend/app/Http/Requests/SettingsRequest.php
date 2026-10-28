<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'platform_name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'brand_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'default_locale' => ['sometimes', Rule::in(['fr', 'en'])],
            'default_currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'password_min_length' => ['sometimes', 'integer', 'between:8,64'],
            'features' => ['sometimes', 'array'],
            'features.expenses' => ['sometimes', 'boolean'],
        ];
    }
}
