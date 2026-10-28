<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
                'currency' => $this->company->currency,
                'locale' => $this->company->locale,
            ] : null),
            'role' => $this->whenLoaded('role', fn () => [
                'id' => $this->role->id,
                'slug' => $this->role->slug,
                'name' => $this->role->name,
                'scope' => $this->role->scope,
            ]),
        ];
    }
}
