<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Journal extends Model
{
    use BelongsToCompany;

    public const TYPES = ['sales', 'purchases', 'bank', 'cash', 'general'];

    protected $fillable = ['company_id', 'code', 'name', 'type', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
