<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\DB;

/**
 * The weekly "master list": the small set of scripts (max 10) that admin enables for a dry run.
 * When it's non-empty it is the ONLY pool users can pick from, and the only symbols the terminal
 * streams. When empty (unset) there is no restriction — the full instrument universe is available.
 */
class MasterList
{
    public const MAX = 10;

    private const KEY = 'master_list';

    /** @return list<string> */
    public static function symbols(): array
    {
        $raw = Setting::get(self::KEY)?->value;
        $arr = $raw ? json_decode($raw, true) : [];
        return is_array($arr) ? array_values(array_filter($arr, 'is_string')) : [];
    }

    public static function active(): bool
    {
        return count(self::symbols()) > 0;
    }

    public static function has(string $symbol): bool
    {
        return in_array($symbol, self::symbols(), true);
    }

    /**
     * Replace the master list (validated against the universe, capped at MAX) and prune every
     * user's watchlist down to it, so only these scripts can stream.
     *
     * @return list<string>
     */
    public static function set(array $symbols, ?string $byName): array
    {
        $clean = array_slice(Nifty50::filterPickable($symbols), 0, self::MAX);
        Setting::put(self::KEY, json_encode($clean), $byName);

        if ($clean) {
            DB::table('watchlist_items')->whereNotIn('symbol', $clean)->delete();
        }

        return $clean;
    }
}
