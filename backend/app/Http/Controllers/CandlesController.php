<?php

namespace App\Http\Controllers;

use App\Services\DhanClient;
use App\Services\HistoryService;
use App\Support\CandleTable;
use App\Support\DhanCredentials;
use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Serves stored candles (real Dhan data when available) for the terminal charts. */
class CandlesController extends Controller
{
    public function show(Request $r, string $symbol): JsonResponse
    {
        $symbol = strtoupper($symbol);
        if (! Nifty50::isValid($symbol)) {
            return response()->json(['message' => 'Unknown symbol.'], 404);
        }

        // Near-live: pull today's latest intraday from Dhan before serving (used by the poller).
        // Only when the token is within its 18-hour window; otherwise serve stored history as-is.
        if ($r->boolean('fresh') && DhanClient::isMapped($symbol) && DhanCredentials::isReady()) {
            try {
                app(HistoryService::class)->updateDay($symbol, CarbonImmutable::now('Asia/Kolkata')->format('Y-m-d'));
            } catch (\Throwable $e) {
                // ignore; fall back to whatever is stored
            }
        }

        if (! CandleTable::exists($symbol)) {
            return response()->json(['symbol' => $symbol, 'date' => null, 'oneMin' => [], 'fiveMin' => []]);
        }

        $table = CandleTable::name($symbol);
        $date = DB::table($table)->max('trade_date');
        if (! $date) {
            return response()->json(['symbol' => $symbol, 'date' => null, 'oneMin' => [], 'fiveMin' => []]);
        }

        // Serve all stored trading days (bounded) so users can scroll back to previous days.
        $since = CarbonImmutable::parse($date)->subDays(45)->format('Y-m-d');
        $rows = DB::table($table)->where('trade_date', '>=', $since)->orderBy('ts')->get();

        $oneMin = [];
        foreach ($rows as $r) {
            $epoch = CarbonImmutable::parse($r->ts, 'Asia/Kolkata')->timestamp;
            $oneMin[] = [
                'ts_epoch' => $epoch,
                'datetime_ist' => $r->ts,
                'open' => (float) $r->open, 'high' => (float) $r->high, 'low' => (float) $r->low, 'close' => (float) $r->close,
                'volume' => (int) $r->volume,
                'atr_trailing_stop' => $r->atr_1m !== null ? (float) $r->atr_1m : null,
                'ut_bot_position' => (int) $r->pos_1m,
                'ut_bot_signal' => $r->signal_1m,
            ];
        }

        // 5-minute: resample OHLCV; flags come from the stored 5-min bucket-start rows.
        $fiveMin = [];
        $cur = null;
        foreach ($rows as $r) {
            $epoch = CarbonImmutable::parse($r->ts, 'Asia/Kolkata')->timestamp;
            $bucket = intdiv($epoch, 300) * 300;
            if (! $cur || $cur['ts_epoch'] !== $bucket) {
                if ($cur) {
                    $fiveMin[] = $cur;
                }
                $cur = [
                    'ts_epoch' => $bucket, 'datetime_ist' => $r->ts,
                    'open' => (float) $r->open, 'high' => (float) $r->high, 'low' => (float) $r->low, 'close' => (float) $r->close,
                    'volume' => (int) $r->volume,
                    'atr_trailing_stop' => $r->atr_5m !== null ? (float) $r->atr_5m : null,
                    'ut_bot_position' => $r->pos_5m !== null ? (int) $r->pos_5m : 0,
                    'ut_bot_signal' => $r->signal_5m,
                ];
            } else {
                $cur['high'] = max($cur['high'], (float) $r->high);
                $cur['low'] = min($cur['low'], (float) $r->low);
                $cur['close'] = (float) $r->close;
                $cur['volume'] += (int) $r->volume;
            }
        }
        if ($cur) {
            $fiveMin[] = $cur;
        }

        return response()->json(['symbol' => $symbol, 'date' => $date, 'oneMin' => $oneMin, 'fiveMin' => $fiveMin]);
    }
}
