<?php

namespace App\Support;

/** Instrument universe helper (NIFTY 50 + Next 50 stocks, MCX commodities, indices). */
class Nifty50
{
    public const GROUP_LABELS = [
        'index' => 'Indices',
        'mcx' => 'MCX Commodities',
        'nifty50' => 'NIFTY 50',
        'next50' => 'Nifty Next 50',
    ];

    /** Default watchlist for new users: the index instruments. */
    public const DEFAULTS = ['NIFTY 50', 'BANKNIFTY', 'GIFTNIFTY', 'SENSEX'];

    /** @return array<int,array> */
    public static function all(): array
    {
        return config('nifty50');
    }

    /** @return array<string,array> keyed by symbol */
    public static function map(): array
    {
        return collect(self::all())->keyBy('symbol')->all();
    }

    public static function isValid(string $symbol): bool
    {
        return isset(self::map()[$symbol]);
    }

    /** Keep only valid symbols, de-duplicated, order preserved. (All instruments are selectable.) */
    public static function filterPickable(array $symbols): array
    {
        $map = self::map();
        $seen = [];
        $out = [];
        foreach ($symbols as $s) {
            $s = strtoupper(trim((string) $s));
            if (isset($map[$s]) && ! isset($seen[$s])) {
                $seen[$s] = true;
                $out[] = $s;
            }
        }
        return $out;
    }

    /**
     * Deterministic demo high/low + % change for 1-day, 5-day and 52-week periods, around the
     * instrument's base price. The % is the period's return (signed). Replaced by real figures
     * once Dhan data is wired in.
     */
    public static function stats(string $symbol, float $base): array
    {
        $seed = crc32($symbol) & 0x7fffffff;
        $next = function () use (&$seed) {
            $seed = ($seed * 16807) % 2147483647;
            return ($seed - 1) / 2147483646;
        };
        $hl = fn (float $up, float $dn) => ['high' => round($base * (1 + $up), 2), 'low' => round($base * (1 - $dn), 2)];

        return [
            'd1_pct' => round(($next() - 0.5) * 4, 2),
            'd1' => $hl($next() * 0.012, $next() * 0.012),
            'd5_pct' => round(($next() - 0.5) * 10, 2),
            'd5' => $hl(0.01 + $next() * 0.04, 0.01 + $next() * 0.04),
            'w52_pct' => round(($next() - 0.5) * 60, 2),
            'w52' => $hl(0.12 + $next() * 0.33, 0.10 + $next() * 0.22),
        ];
    }

    /** Full instrument list enriched for the config screen. */
    public static function enriched(): array
    {
        return array_map(function ($i) {
            $st = self::stats($i['symbol'], $i['base']);
            return [
                'symbol' => $i['symbol'],
                'name' => $i['name'],
                'exchange' => $i['exchange'],
                'display' => $i['exchange'].':'.$i['symbol'],
                'kind' => $i['kind'],
                'group' => $i['group'],
                'group_label' => self::GROUP_LABELS[$i['group']] ?? $i['group'],
                'ltp' => $i['base'],
                'd1_high' => $st['d1']['high'], 'd1_low' => $st['d1']['low'], 'd1_pct' => $st['d1_pct'],
                'd5_high' => $st['d5']['high'], 'd5_low' => $st['d5']['low'], 'd5_pct' => $st['d5_pct'],
                'week52_high' => $st['w52']['high'], 'week52_low' => $st['w52']['low'], 'week52_pct' => $st['w52_pct'],
            ];
        }, self::all());
    }
}
