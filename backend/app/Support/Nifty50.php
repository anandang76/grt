<?php

namespace App\Support;

class Nifty50
{
    /** @return array<int,array{symbol:string,name:string,security_id:?string,segment:string}> */
    public static function all(): array
    {
        return config('nifty50');
    }

    /** @return array<string,array{symbol:string,name:string,security_id:?string,segment:string}> keyed by symbol */
    public static function map(): array
    {
        return collect(self::all())->keyBy('symbol')->all();
    }

    public static function isValid(string $symbol): bool
    {
        return isset(self::map()[$symbol]);
    }

    /** Keep only valid NIFTY 50 symbols, de-duplicated, order preserved. */
    public static function filter(array $symbols): array
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
}
