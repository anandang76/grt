<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Services\HistoryService;
use App\Services\StatsService;
use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/**
 * Cron entry point: pull/refresh intraday candles (with UT Bot flags) for every instrument.
 * Scheduled for 16:00 and 23:00 IST, but runnable standalone on any server/cron.
 *
 *   php artisan grt:refresh-history                 # latest trading day, all instruments
 *   php artisan grt:refresh-history --days=5        # last 5 trading days
 *   php artisan grt:refresh-history --symbols=TCS,EICHERMOT
 */
class RefreshHistory extends Command
{
    protected $signature = 'grt:refresh-history {--days=1 : Number of recent trading days} {--symbols= : Comma-separated symbols (default: all)} {--no-stats : Skip the daily quote-stats refresh}';

    protected $description = 'Refresh intraday candles + quote stats for all instruments (daily cron at 4pm & 11pm IST)';

    public function handle(HistoryService $history, StatsService $stats): int
    {
        $days = max(1, (int) $this->option('days'));
        $only = $this->option('symbols')
            ? array_map(fn ($s) => strtoupper(trim($s)), explode(',', $this->option('symbols')))
            : null;

        $symbols = collect(Nifty50::all())->pluck('symbol')
            ->when($only, fn ($c) => $c->filter(fn ($s) => in_array($s, $only, true)))
            ->values();

        if ($symbols->isEmpty()) {
            $this->error('No matching instruments.');
            return self::FAILURE;
        }

        // Most recent N trading days (weekdays), newest first.
        $dates = [];
        $d = CarbonImmutable::now('Asia/Kolkata');
        while (count($dates) < $days) {
            if (! $d->isWeekend()) {
                $dates[] = $d->format('Y-m-d');
            }
            $d = $d->subDay();
        }

        $this->info('Refreshing '.$symbols->count().' instruments × '.count($dates).' day(s): '.implode(', ', $dates));
        $bar = $this->output->createProgressBar($symbols->count());
        $bar->start();

        $doStats = ! $this->option('no-stats');
        $rows = 0;
        $failed = [];
        foreach ($symbols as $sym) {
            try {
                foreach ($dates as $date) {
                    $rows += $history->updateDay($sym, $date)['minutes'];
                }
                if ($doStats) {
                    $stats->refresh($sym);
                }
            } catch (\Throwable $e) {
                $failed[] = $sym;
                $this->newLine();
                $this->warn("  $sym failed: ".$e->getMessage());
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine(2);

        $this->info("Done: $rows rows across ".($symbols->count() - count($failed)).' instruments'.($failed ? ', '.count($failed).' failed' : '').'.');
        AuditLog::record('history_cron', null, ['instruments' => $symbols->count(), 'days' => count($dates), 'rows' => $rows, 'failed' => count($failed)]);

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
