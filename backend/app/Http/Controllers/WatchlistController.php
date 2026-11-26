<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\MasterList;
use App\Support\Nifty50;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WatchlistController extends Controller
{
    public const MAX = 25;

    /** How many instruments a user may pick: the whole master list when active, else MAX. */
    public static function userMax(): int
    {
        return MasterList::active() ? max(1, count(MasterList::symbols())) : self::MAX;
    }

    /** A user's selected instruments, in their saved order, with real LTP/change where available. */
    public static function forUser(int $userId): array
    {
        $symbols = DB::table('watchlist_items')->where('user_id', $userId)->orderBy('sort')->pluck('symbol');
        $map = Nifty50::map();
        $stats = DB::table('instrument_stats')->get()->keyBy('symbol');

        return $symbols
            ->filter(fn ($s) => isset($map[$s]) && (! MasterList::active() || MasterList::has($s)))
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
        $pick = Nifty50::filterPickable($symbols);
        if (MasterList::active()) {
            $pick = array_values(array_filter($pick, fn ($s) => MasterList::has($s)));
        }
        $clean = array_slice($pick, 0, self::userMax());

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
        return ['watchlist' => self::forUser($r->user()->id), 'max' => self::userMax(), 'restricted' => MasterList::active()];
    }

    public function update(Request $r): array
    {
        $data = $r->validate([
            'symbols' => 'present|array|max:200',
            'symbols.*' => 'string|max:30',
        ]);
        $watchlist = self::setForUser($r->user()->id, $data['symbols']);
        AuditLog::record('watchlist_update', $r->user()->id, ['count' => count($watchlist)]);

        return ['watchlist' => $watchlist, 'max' => self::userMax(), 'restricted' => MasterList::active()];
    }

    /** Selectable instruments for the config screen — the master list when active, else the full
     *  universe — grouped and enriched (52w high/low, exchange). */
    public function instruments(): array
    {
        $all = Nifty50::enriched();
        if (MasterList::active()) {
            $set = array_flip(MasterList::symbols());
            $all = array_values(array_filter($all, fn ($i) => isset($set[$i['symbol']])));
        }

        return ['instruments' => $all, 'groups' => Nifty50::GROUP_LABELS, 'max' => self::userMax(), 'restricted' => MasterList::active()];
    }
}
