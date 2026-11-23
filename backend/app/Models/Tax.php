<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Tax extends Model
{
    use BelongsToCompany;

    public const SCOPES = ['sales', 'purchases'];

    protected $fillable = ['company_id', 'name', 'rate', 'scope', 'is_active'];

    protected $casts = ['rate' => 'decimal:2', 'is_active' => 'boolean'];
}
