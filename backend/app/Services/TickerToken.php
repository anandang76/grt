<?php

namespace App\Services;

use App\Models\User;

/** Short-lived HS256 JWT that lets the browser connect to the Node tick service. */
class TickerToken
{
    public static function issue(User $user): string
    {
        $b64 = fn (string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $header = $b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = $b64(json_encode([
            'sub' => $user->id,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + (int) config('services.ticker.ttl', 300),
        ]));
        $sig = $b64(hash_hmac('sha256', "$header.$payload", (string) config('services.ticker.secret'), true));

        return "$header.$payload.$sig";
    }
}
