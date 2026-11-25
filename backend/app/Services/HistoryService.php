<?php

namespace App\Services;

use App\Support\CandleTable;
use App\Support\Nifty50;
use App\Support\UtBot;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Builds and stores intraday history for a symbol/day: 1-minute candles with 1-min UT Bot flags,
 * plus 5-minute UT Bot flags written onto the bucket-start rows (separate columns).
 *
 * Data source today is a deterministic demo generator (no real Dhan credentials / static IP yet).
 * When Dhan is connected, replace fetchOneMinute() with a call to Dhan's intraday history API
 * returning the same bar shape; the storage + UT Bot logic below stays the same.
 */
class HistoryService
{
    /** Update one trading day for one symbol. Returns ['minutes'=>int,'buckets'=>int]. */
    public function updateDay(string $symbol, string $date): array
    {
        $symbol = strtoupper($symbol);
        if (! Nifty50::isValid($symbol)) {
            throw new \InvalidArgumentException("Unknown symbol: $symbol");
        }

        $oneMin = $this->fetchOneMinute($symbol, $date);
        if (! $oneMin) {
            return ['minutes' => 0, 'buckets' => 0];
        }

        $oneMin = UtBot::compute($oneMin, 1, 10);

        // Resample to 5-minute, compute UT Bot, index flags by bucket-start timestamp.
        $fiveMin = UtBot::compute($this->resample5($oneMin), 1, 10);
        $five = [];
        foreach ($fiveMin as $b) {
            $five[$b['ts']] = $b;
        }

        $now = now();
        $rows = [];
        foreach ($oneMin as $b) {
            $f = $five[$b['ts']] ?? null; // non-null only on 5-min bucket starts
            $rows[] = [
                'trade_date' => $date,
                'ts' => $b['ts'],
                'open' => $b['open'], 'high' => $b['high'], 'low' => $b['low'], 'close' => $b['close'],
                'volume' => $b['volume'],
                'atr_1m' => $b['atr_stop'], 'pos_1m' => $b['position'], 'signal_1m' => $b['signal'],
                'atr_5m' => $f['atr_stop'] ?? null, 'pos_5m' => $f['position'] ?? null, 'signal_5m' => $f['signal'] ?? null,
                'updated_at' => $now,
            ];
        }

        $table = CandleTable::ensure($symbol);
        DB::transaction(function () use ($table, $date, $rows) {
            DB::table($table)->where('trade_date', $date)->delete();
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table($table)->insert($chunk);
            }
        });

        return ['minutes' => count($oneMin), 'buckets' => count($fiveMin)];
    }

    /** Group 1-min bars into 5-min OHLCV (bucket start = first minute's ts). */
    private function resample5(array $oneMin): array
    {
        $out = [];
        $cur = null;
        foreach ($oneMin as $b) {
            $min = (int) CarbonImmutable::parse($b['ts'])->format('Hi');
            $bucket = intdiv((int) CarbonImmutable::parse($b['ts'])->timestamp / 60, 5); // 5-min bucket index
            if (! $cur || $cur['_bucket'] !== $bucket) {
                if ($cur) {
                    unset($cur['_bucket']);
                    $out[] = $cur;
                }
                $cur = ['_bucket' => $bucket, 'ts' => $b['ts'], 'open' => $b['open'], 'high' => $b['high'], 'low' => $b['low'], 'close' => $b['close'], 'volume' => $b['volume']];
            } else {
                $cur['high'] = max($cur['high'], $b['high']);
                $cur['low'] = min($cur['low'], $b['low']);
                $cur['close'] = $b['close'];
                $cur['volume'] += $b['volume'];
            }
            unset($min);
        }
        if ($cur) {
            unset($cur['_bucket']);
            $out[] = $cur;
        }
        return $out;
    }

    /**
     * DEMO 1-minute bars for a trading day (09:15–15:30 IST = 375 bars), deterministic per
     * symbol+date. Replace with Dhan intraday history when credentials + static IP are ready.
     *
     * @return array<int,array{ts:string,open:float,high:float,low:float,close:float,volume:int}>
     */
    private function fetchOneMinute(string $symbol, string $date): array
    {
        $day = CarbonImmutable::parse($date, 'Asia/Kolkata');
        if ($day->isWeekend() || $day->isFuture()) {
            return [];
        }

        $seed = crc32($symbol.$date) & 0x7fffffff;
        $rand = function () use (&$seed) {
            $seed = ($seed * 16807) % 2147483647;
            return ($seed - 1) / 2147483646;
        };

        $base = Nifty50::map()[$symbol]['base'] ?? 500.0;
        $price = $base;
        $start = $day->setTime(9, 15);
        $bars = [];
        for ($i = 0; $i < 375; $i++) {
            // Random walk that mean-reverts toward the base, so the intraday range stays realistic.
            $open = $price;
            $move = ($rand() - 0.5) * $base * 0.0016 + ($base - $open) * 0.0025;
            $close = max(1, $open + $move);
            $high = max($open, $close) + $rand() * $base * 0.0007;
            $low = min($open, $close) - $rand() * $base * 0.0007;
            $bars[] = [
                'ts' => $start->addMinutes($i)->format('Y-m-d H:i:s'),
                'open' => round($open, 2), 'high' => round($high, 2), 'low' => round($low, 2), 'close' => round($close, 2),
                'volume' => (int) (2000 + $rand() * 40000),
            ];
            $price = $close;
        }
        return $bars;
    }
}
