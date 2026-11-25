<?php

namespace App\Http\Controllers;

use App\Support\CandleTable;
use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/** Serves stored candles (real Dhan data when available) for the terminal charts. */
class CandlesController extends Controller
{
    public function show(string $symbol): JsonResponse
    {
        $symbol = strtoupper($symbol);
        if (! Nifty50::isValid($symbol)) {
            return response()->json(['message' => 'Unknown symbol.'], 404);
        }
        if (! CandleTable::exists($symbol)) {
            return response()->json(['symbol' => $symbol, 'date' => null, 'oneMin' => [], 'fiveMin' => []]);
        }

        $table = CandleTable::name($symbol);
        $date = DB::table($table)->max('trade_date');
        if (! $date) {
            return response()->json(['symbol' => $symbol, 'date' => null, 'oneMin' => [], 'fiveMin' => []]);
        }

        $rows = DB::table($table)->where('trade_date', $date)->orderBy('ts')->get();

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
