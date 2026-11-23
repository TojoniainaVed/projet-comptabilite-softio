<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PaymentTerm */
class PaymentTermResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'days' => $this->days,
            'end_of_month' => $this->end_of_month,
            'is_active' => $this->is_active,
        ];
    }
}
