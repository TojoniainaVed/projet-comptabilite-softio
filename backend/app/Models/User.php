<?php

namespace App\Models;

use App\Support\PermissionCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'company_id', 'role_id', 'name', 'email', 'password', 'is_active', 'last_login_at',
        'email_verified_at', 'must_verify_email',
    ];

    protected $hidden = ['password'];

    /** @var list<string>|null */
    private ?array $permissionCache = null;

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'must_verify_email' => 'boolean',
        ];
    }

    /** Les adresses e-mail sont toujours enregistrées en minuscules. */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtolower(trim($value)));
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** @return list<string> */
    public function permissionSlugs(): array
    {
        return $this->permissionCache ??= $this->role
            ? $this->role->permissions()->pluck('slug')->all()
            : [];
    }

    public function hasPermission(string $slug): bool
    {
        return in_array($slug, $this->permissionSlugs(), true);
    }

    public function isPlatformAdmin(): bool
    {
        return $this->role?->scope === PermissionCatalog::PLATFORM;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role?->slug === PermissionCatalog::SUPER_ADMIN;
    }

    /** Utilisateurs visibles par $viewer : toute la plateforme ou sa propre entreprise. */
    public function scopeVisibleTo(Builder $query, self $viewer): Builder
    {
        return $viewer->isPlatformAdmin()
            ? $query
            : $query->where('company_id', $viewer->company_id);
    }
}
