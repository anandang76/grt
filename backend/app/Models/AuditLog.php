<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'action', 'target_id', 'meta', 'ip', 'created_at'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'created_at' => 'datetime'];
    }

    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'actor_id'); }
    public function target(): BelongsTo { return $this->belongsTo(User::class, 'target_id'); }

    public static function record(string $action, ?int $targetId = null, array $meta = [], ?int $actorId = null): void
    {
        static::create([
            'actor_id' => $actorId ?? auth()->id(),
            'action' => $action,
            'target_id' => $targetId,
            'meta' => $meta ?: null,
            'ip' => request()?->ip(),
        ]);
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'meta' => $this->meta,
            'ip' => $this->ip,
            'created_at' => $this->created_at,
            'actor' => $this->actor ? ['id' => $this->actor->id, 'name' => $this->actor->name] : null,
            'target' => $this->target ? ['id' => $this->target->id, 'name' => $this->target->name] : null,
        ];
    }
}
