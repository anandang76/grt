<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Setting extends Model
{
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['key', 'value', 'updated_by_name', 'updated_at'];
    protected $casts = ['updated_at' => 'datetime'];

    public static function get(string $key): ?self
    {
        return static::find($key);
    }

    public static function put(string $key, ?string $value, ?string $byName): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => $key],
            ['value' => $value, 'updated_by_name' => $byName, 'updated_at' => now()],
        );
    }
}
