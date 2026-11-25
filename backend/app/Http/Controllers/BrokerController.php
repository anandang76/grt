<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Setting;
use App\Support\DhanCredentials;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Shared Dhan API credentials for all users:
 *  - Client ID: set once (rarely changes).
 *  - Access token: re-entered daily (Dhan tokens expire each day).
 * Any logged-in active user may view status and update either value.
 */
class BrokerController extends Controller
{
    private const CLIENT = 'dhan_client_id';
    private const TOKEN = 'dhan_token';

    public function show(): array
    {
        return ['dhan' => $this->status()];
    }

    /** Set once; rarely changes. */
    public function updateClientId(Request $r): JsonResponse
    {
        $data = $r->validate(['client_id' => 'required|string|min:3|max:50|regex:/^[A-Za-z0-9._-]+$/']);
        $clientId = trim($data['client_id']);

        if ($clientId !== (Setting::get(self::CLIENT)->value ?? null)) {
            Setting::put(self::CLIENT, $clientId, $r->user()->name);
            DhanCredentials::flush();
            AuditLog::record('dhan_client_id_update', null, ['by' => $r->user()->name]);
        }

        return response()->json(['dhan' => $this->status(), 'message' => 'Client ID saved.']);
    }

    /** Re-entered daily. */
    public function updateToken(Request $r): JsonResponse
    {
        $data = $r->validate(['token' => 'required|string|min:20|max:4000']);
        Setting::put(self::TOKEN, trim($data['token']), $r->user()->name);
        DhanCredentials::flush();
        AuditLog::record('dhan_token_update', null, ['by' => $r->user()->name]);

        return response()->json(['dhan' => $this->status(), 'message' => 'Access token updated for today.']);
    }

    private function status(): array
    {
        $client = Setting::get(self::CLIENT);
        $tok = Setting::get(self::TOKEN);
        $token = $tok?->value;
        $tokenAt = $tok?->updated_at;
        // The daily token is stale once it's from a previous calendar day.
        $tokenStale = ! $tokenAt || ! $tokenAt->isToday();

        return [
            'client_id' => $client?->value,                 // shown in full: it identifies the account, not a secret on its own
            'client_id_updated_at' => $client?->updated_at,
            'client_id_updated_by' => $client?->updated_by_name,
            'token_set' => (bool) $token,
            'token_masked' => $token ? substr($token, 0, 6).'…'.substr($token, -4) : null,
            'token_updated_at' => $tokenAt,
            'token_updated_by' => $tok?->updated_by_name,
            'token_stale' => $token ? $tokenStale : true,
            'ready' => (bool) ($client?->value && $token && ! $tokenStale),
        ];
    }
}
