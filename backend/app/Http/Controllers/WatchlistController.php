<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Nifty50;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WatchlistController extends Controller
{
    public const MAX = 25;

    /** A user's selected instruments, in their saved order, with real LTP/change where available. */
    public static function forUser(int $userId): array
    {
        $symbols = DB::table('watchlist_items')->where('user_id', $userId)->orderBy('sort')->pluck('symbol');
        $map = Nifty50::map();
        $stats = DB::table('instrument_stats')->get()->keyBy('symbol');

        return $symbols
            ->filter(fn ($s) => isset($map[$s]))
            ->map(function ($s) use ($map, $stats) {
                $r = $stats[$s] ?? null;
                return [
                    'symbol' => $s, 'name' => $map[$s]['name'], 'kind' => $map[$s]['kind'], 'exchange' => $map[$s]['exchange'],
                    'ltp' => $r ? (float) $r->ltp : null, 'chp' => $r ? (float) $r->d1_pct : null, 'live' => $r !== null,
                ];
            })
            ->values()->all();
    }

    /** Seed a new user's watchlist with the default instruments (the indices), if empty. */
    public static function seedDefaults(int $userId): void
    {
        if (DB::table('watchlist_items')->where('user_id', $userId)->exists()) {
            return;
        }
        self::setForUser($userId, Nifty50::DEFAULTS);
    }

    /** Replace a user's watchlist stocks with the given ordered list (validated, max MAX). */
    public static function setForUser(int $userId, array $symbols): array
    {
        $clean = array_slice(Nifty50::filterPickable($symbols), 0, self::MAX);

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
            'symbols' => 'present|array|max:200',
            'symbols.*' => 'string|max:30',
        ]);
        $watchlist = self::setForUser($r->user()->id, $data['symbols']);
        AuditLog::record('watchlist_update', $r->user()->id, ['count' => count($watchlist)]);

        return ['watchlist' => $watchlist, 'max' => self::MAX];
    }

    /** All selectable instruments for the config screen, grouped and enriched (52w high/low, exchange). */
    public function instruments(): array
    {
        return ['instruments' => Nifty50::enriched(), 'groups' => Nifty50::GROUP_LABELS, 'max' => self::MAX];
    }
}
