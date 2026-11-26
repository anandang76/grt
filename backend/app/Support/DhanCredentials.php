<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The shared Dhan Client ID + access token, read from the settings table.
 * Cached in memory for the current request so repeated reads don't hit the DB;
 * call flush() after any update. Future Dhan API calls read credentials from here.
 */
class DhanCredentials
{
    /** A freshly-entered token drives live data for this many hours, then auto-expires. */
    public const TOKEN_TTL_HOURS = 18;

    private static ?array $cache = null;

    public static function current(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $client = Setting::get('dhan_client_id');
        $token = Setting::get('dhan_token');
        $tokenAt = $token?->updated_at;
        $expiresAt = $tokenAt?->copy()->addHours(self::TOKEN_TTL_HOURS);

        return self::$cache = [
            'client_id' => $client?->value,
            'token' => $token?->value,
            'token_updated_at' => $tokenAt,
            'expires_at' => $token?->value ? $expiresAt : null,
            // Ready to call Dhan only when both exist and the token is within its 18-hour window.
            'ready' => (bool) ($client?->value && $token?->value && $expiresAt && $expiresAt->isFuture()),
        ];
    }

    public static function expiresAt(): ?\Carbon\CarbonInterface
    {
        return self::current()['expires_at'];
    }

    public static function clientId(): ?string
    {
        return self::current()['client_id'];
    }

    public static function token(): ?string
    {
        return self::current()['token'];
    }

    public static function isReady(): bool
    {
        return self::current()['ready'];
    }

    public static function flush(): void
    {
        self::$cache = null;
    }
}
