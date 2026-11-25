<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Http\Request;

/**
 * Shared Dhan API token. One token for all users, re-entered daily (Dhan tokens expire each day).
 * Any logged-in active user may view status and update it.
 */
class BrokerController extends Controller
{
    private const KEY = 'dhan_token';

    public function show(): array
    {
        return ['dhan' => $this->status()];
    }

    public function update(Request $r): array
    {
        $data = $r->validate(['token' => 'required|string|min:20|max:4000']);
        Setting::put(self::KEY, trim($data['token']), $r->user()->name);
        AuditLog::record('dhan_token_update', null, ['by' => $r->user()->name]);

        return ['dhan' => $this->status(), 'message' => 'Dhan token updated.'];
    }

    private function status(): array
    {
        $s = Setting::get(self::KEY);
        $token = $s?->value;
        $updatedAt = $s?->updated_at;
        // A Dhan token is treated as stale once it's from a previous calendar day.
        $stale = ! $updatedAt || ! $updatedAt->isToday();

        return [
            'configured' => (bool) $token,
            'masked' => $token ? substr($token, 0, 6).'…'.substr($token, -4) : null,
            'updated_at' => $updatedAt,
            'updated_by' => $s?->updated_by_name,
            'stale' => $token ? $stale : true,
        ];
    }
}
