<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class PaymentTerm extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'name', 'days', 'end_of_month', 'is_active'];

    protected $casts = ['days' => 'integer', 'end_of_month' => 'boolean', 'is_active' => 'boolean'];
}
