<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    public const ROLE_RANK = ['user' => 1, 'admin' => 2, 'superadmin' => 3];
    public const ROLE_LABELS = ['user' => 'User', 'admin' => 'Admin', 'superadmin' => 'Super Admin'];
    public const STATUSES = ['pending', 'active', 'inactive', 'rejected'];

    protected $fillable = [
        'name', 'email', 'phone', 'password', 'google_id', 'role', 'status', 'must_change_password',
        'email_verified_at', 'terms_accepted_at', 'approved_by', 'approved_at', 'last_login_at', 'remember_until',
    ];

    protected $hidden = ['password', 'remember_token', 'google_id'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'approved_at' => 'datetime',
            'last_login_at' => 'datetime',
            'remember_until' => 'datetime',
            'must_change_password' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isAdmin(): bool { return in_array($this->role, ['admin', 'superadmin'], true); }
    public function isSuper(): bool { return $this->role === 'superadmin'; }
    public function rank(): int { return self::ROLE_RANK[$this->role] ?? 0; }

    /** Strictly higher rank, and never yourself. */
    public function canManage(User $target): bool
    {
        return $this->id !== $target->id && $this->rank() > $target->rank();
    }

    /** Message explaining why this user cannot log in, or null if they can. */
    public function blockReason(): ?string
    {
        return match ($this->status) {
            'active' => null,
            'pending' => 'Your account is awaiting admin approval. We will email you once it is approved.',
            'inactive' => 'Your account is inactive. Please contact support.',
            'rejected' => 'Your signup request was not approved. Please contact support.',
            default => 'This account is unavailable.',
        };
    }

    /** Shape returned to the SPA for the signed-in user. */
    public function toSelf(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'role_label' => self::ROLE_LABELS[$this->role] ?? $this->role,
            'status' => $this->status,
            'must_change_password' => $this->must_change_password,
            'has_password' => $this->password !== null,
            'has_google' => $this->google_id !== null,
        ];
    }

    /** Shape returned to admins. */
    public function toAdmin(): array
    {
        return $this->toSelf() + [
            'email_verified_at' => $this->email_verified_at,
            'terms_accepted_at' => $this->terms_accepted_at,
            'approved_at' => $this->approved_at,
            'approved_by_name' => $this->approver?->name,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
        ];
    }
}
