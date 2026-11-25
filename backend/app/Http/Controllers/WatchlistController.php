<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Nifty50;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WatchlistController extends Controller
{
    public const MAX = 10;

    /** Symbols for a user, in sort order, enriched with NIFTY 50 metadata. */
    public static function forUser(int $userId): array
    {
        $symbols = DB::table('watchlist_items')->where('user_id', $userId)->orderBy('sort')->pluck('symbol');
        $map = Nifty50::map();

        return $symbols
            ->filter(fn ($s) => isset($map[$s]))
            ->map(fn ($s) => ['symbol' => $s, 'name' => $map[$s]['name']])
            ->values()->all();
    }

    /** Replace a user's watchlist with the given ordered symbol list (validated, max MAX). */
    public static function setForUser(int $userId, array $symbols): array
    {
        $clean = array_slice(Nifty50::filter($symbols), 0, self::MAX);

        DB::transaction(function () use ($userId, $clean) {
            DB::table('watchlist_items')->where('user_id', $userId)->delete();
            $now = now();
            $rows = [];
            foreach ($clean as $i => $symbol) {
                $rows[] = ['user_id' => $userId, 'symbol' => $symbol, 'sort' => $i, 'created_at' => $now, 'updated_at' => $now];
            }
            if ($rows) {
                DB::table('watchlist_items')->insert($rows);
            }
        });

        return self::forUser($userId);
    }

    public function index(Request $r): array
    {
        return ['watchlist' => self::forUser($r->user()->id), 'max' => self::MAX];
    }

    public function update(Request $r): array
    {
        $data = $r->validate([
            'symbols' => 'present|array|max:60',
            'symbols.*' => 'string|max:30',
        ]);
        $watchlist = self::setForUser($r->user()->id, $data['symbols']);
        AuditLog::record('watchlist_update', $r->user()->id, ['count' => count($watchlist)]);

        return ['watchlist' => $watchlist, 'max' => self::MAX];
    }

    /** The full NIFTY 50 list for the config screen. */
    public function nifty50(): array
    {
        return ['symbols' => array_map(fn ($c) => ['symbol' => $c['symbol'], 'name' => $c['name']], Nifty50::all())];
    }
}
