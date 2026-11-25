<?php

namespace App\Services;

use App\Support\DhanCredentials;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Builds the config-screen quote stats (LTP, 52W/5D/1D high-low-%) from Dhan daily history. */
class StatsService
{
    public function __construct(private DhanClient $dhan) {}

    /** Refresh cached stats for one symbol. Returns true if real data was stored. */
    public function refresh(string $symbol): bool
    {
        if (! DhanClient::isMapped($symbol) || ! DhanCredentials::current()['token']) {
            return false;
        }
        $now = CarbonImmutable::now('Asia/Kolkata');
        $bars = $this->dhan->daily($symbol, $now->subYear()->subWeek()->format('Y-m-d'), $now->addDay()->format('Y-m-d'));
        if (count($bars) < 2) {
            return false;
        }

        $n = count($bars);
        $last = $bars[$n - 1];
        $prev = $bars[$n - 2];
        $ltp = $last['close'];
        $highs = array_column($bars, 'high');
        $lows = array_column($bars, 'low');

        $last5 = array_slice($bars, -5);
        $base5 = $bars[max(0, $n - 6)]['close'];
        $pct = fn ($from) => $from ? round(($ltp - $from) / $from * 100, 2) : 0;

        DB::table('instrument_stats')->updateOrInsert(['symbol' => $symbol], [
            'ltp' => $ltp,
            'w52_high' => max($highs), 'w52_low' => min($lows), 'w52_pct' => $pct($bars[0]['close']),
            'd5_high' => max(array_column($last5, 'high')), 'd5_low' => min(array_column($last5, 'low')), 'd5_pct' => $pct($base5),
            'd1_high' => $last['high'], 'd1_low' => $last['low'], 'd1_pct' => $pct($prev['close']),
            'updated_at' => now(),
        ]);
        return true;
    }
}
