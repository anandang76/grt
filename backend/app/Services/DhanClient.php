<?php

namespace App\Services;

use App\Support\DhanCredentials;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Thin client for Dhan's historical market-data APIs (read-only — no static IP needed).
 * Credentials come from the shared settings (DhanCredentials). Timestamps returned by Dhan are
 * UTC epoch seconds; we convert to IST wall-clock strings to match how candles are stored.
 */
class DhanClient
{
    private const BASE = 'https://api.dhan.co/v2';

    public static function mapping(string $symbol): ?object
    {
        return DB::table('instrument_map')->where('symbol', $symbol)->first();
    }

    public static function isMapped(string $symbol): bool
    {
        return self::mapping($symbol) !== null;
    }

    private static float $lastCall = 0;

    private function headers(): array
    {
        $c = DhanCredentials::current();
        if (! $c['token'] || ! $c['client_id']) {
            throw new \RuntimeException('Dhan credentials are not set.');
        }
        return ['access-token' => $c['token'], 'client-id' => (string) $c['client_id'], 'Content-Type' => 'application/json', 'Accept' => 'application/json'];
    }

    /** POST with a min 300ms spacing between calls and backoff on Dhan's 429 rate limit. */
    private function post(string $path, array $body)
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $wait = 0.3 - (microtime(true) - self::$lastCall);
            if ($wait > 0) {
                usleep((int) ($wait * 1_000_000));
            }
            self::$lastCall = microtime(true);

            $resp = Http::withHeaders($this->headers())->timeout(30)->post(self::BASE.$path, $body);
            if ($resp->status() !== 429) {
                return $resp;
            }
            usleep(($attempt + 1) * 1_000_000); // 1s, 2s, 3s, 4s backoff
        }
        return $resp;
    }

    /** 1-minute candles for one trading day. Returns [] if the symbol isn't mapped or no data. */
    public function intradayDay(string $symbol, string $date): array
    {
        $m = self::mapping($symbol);
        if (! $m) {
            return [];
        }
        $next = CarbonImmutable::parse($date)->addDay()->format('Y-m-d');
        $resp = $this->post('/charts/intraday', [
            'securityId' => $m->security_id,
            'exchangeSegment' => $m->segment,
            'instrument' => $m->instrument,
            'interval' => '1',
            'oi' => false,
            'fromDate' => "$date 00:00:00",
            'toDate' => "$next 00:00:00",
        ]);
        if (! $resp->ok()) {
            throw new \RuntimeException("Dhan intraday failed for $symbol: HTTP ".$resp->status().' '.substr($resp->body(), 0, 200));
        }
        return $this->toBars($resp->json(), $date);
    }

    /** Daily candles between two dates (inclusive of from, non-inclusive of to). */
    public function daily(string $symbol, string $from, string $to): array
    {
        $m = self::mapping($symbol);
        if (! $m) {
            return [];
        }
        $resp = $this->post('/charts/historical', [
            'securityId' => $m->security_id,
            'exchangeSegment' => $m->segment,
            'instrument' => $m->instrument,
            'expiryCode' => 0,
            'oi' => false,
            'fromDate' => $from,
            'toDate' => $to,
        ]);
        if (! $resp->ok()) {
            throw new \RuntimeException("Dhan daily failed for $symbol: HTTP ".$resp->status().' '.substr($resp->body(), 0, 200));
        }
        return $this->toBars($resp->json(), null);
    }

    /** Dhan parallel arrays -> list of bars with IST ts. $onlyDate keeps a single trading day. */
    private function toBars(?array $j, ?string $onlyDate): array
    {
        if (! is_array($j) || empty($j['timestamp'])) {
            return [];
        }
        $bars = [];
        foreach ($j['timestamp'] as $i => $epoch) {
            $ts = gmdate('Y-m-d H:i:s', (int) $epoch + 19800); // UTC epoch -> IST wall-clock
            if ($onlyDate !== null && substr($ts, 0, 10) !== $onlyDate) {
                continue;
            }
            $bars[] = [
                'ts' => $ts,
                'open' => round((float) $j['open'][$i], 2),
                'high' => round((float) $j['high'][$i], 2),
                'low' => round((float) $j['low'][$i], 2),
                'close' => round((float) $j['close'][$i], 2),
                'volume' => (int) ($j['volume'][$i] ?? 0),
            ];
        }
        return $bars;
    }
}
