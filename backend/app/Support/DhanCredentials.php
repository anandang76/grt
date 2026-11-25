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
    private static ?array $cache = null;

    public static function current(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $client = Setting::get('dhan_client_id');
        $token = Setting::get('dhan_token');
        $tokenAt = $token?->updated_at;

        return self::$cache = [
            'client_id' => $client?->value,
            'token' => $token?->value,
            'token_updated_at' => $tokenAt,
            // Ready to call Dhan only when both exist and the token is from today.
            'ready' => (bool) ($client?->value && $token?->value && $tokenAt && $tokenAt->isToday()),
        ];
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
