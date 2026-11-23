<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/** Verifies a Google Identity Services ID token (JWT) using Google's tokeninfo endpoint. */
class GoogleVerifier
{
    public function verify(string $idToken): ?array
    {
        $clientId = config('services.google.client_id');
        if ($idToken === '' || ! $clientId) {
            return null;
        }

        try {
            $res = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $idToken]);
        } catch (\Throwable) {
            return null;
        }
        if (! $res->ok()) {
            return null;
        }

        $c = $res->json();
        $verified = in_array($c['email_verified'] ?? null, [true, 'true'], true);
        if (($c['aud'] ?? '') !== $clientId
            || ! in_array($c['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || ! $verified || empty($c['email']) || empty($c['sub'])
            || (int) ($c['exp'] ?? 0) < time()) {
            return null;
        }

        return $c;
    }
}
