<?php

namespace App\Console\Commands;

use App\Services\HistoryService;
use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Keep today's candles current in the DB for instruments that are in any watchlist and whose
 * market is open right now. Re-pulls today's per-minute data from Dhan (delete + reinsert +
 * recompute UT Bot) so the next day's charts load with correct bars and signals.
 *
 * Scheduled every few minutes; skips symbols whose market is closed (no Dhan calls then).
 */
class LiveRefresh extends Command
{
    protected $signature = 'grt:live-refresh';

    protected $description = 'Refresh today\'s candles for open-market watchlist symbols';

    public function handle(HistoryService $history): int
    {
        $now = CarbonImmutable::now('Asia/Kolkata');
        $date = $now->format('Y-m-d');
        $map = Nifty50::map();

        $symbols = DB::table('watchlist_items')->distinct()->pluck('symbol')
            ->filter(fn ($s) => isset($map[$s]) && $this->open($map[$s]['kind'], $now))
            ->values();

        $done = 0;
        foreach ($symbols as $sym) {
            try {
                $history->updateDay($sym, $date);
                $done++;
            } catch (\Throwable $e) {
                // ignore individual failures
            }
        }
        $this->info("live-refresh: updated $done symbol(s).");
        return self::SUCCESS;
    }

    private function open(string $kind, CarbonImmutable $now): bool
    {
        if ($now->isWeekend()) {
            return false;
        }
        $m = $now->hour * 60 + $now->minute;
        return $kind === 'commodity' ? ($m >= 540 && $m <= 1410) : ($m >= 555 && $m <= 930);
    }
}
