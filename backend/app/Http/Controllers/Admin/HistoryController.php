<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\HistoryService;
use App\Support\CandleTable;
use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HistoryController extends Controller
{
    private const MAX_DAYS = 10;   // per update request
    private const WINDOW = 30;     // trading days shown

    /** Left-menu list: every instrument with how many days of stored data its table holds. */
    public function symbols(): array
    {
        $symbols = array_map(function ($i) {
            $days = 0;
            $last = null;
            if (CandleTable::exists($i['symbol'])) {
                $row = DB::table(CandleTable::name($i['symbol']))
                    ->selectRaw('COUNT(DISTINCT trade_date) days, MAX(updated_at) last')->first();
                $days = (int) $row->days;
                $last = $row->last;
            }
            return ['symbol' => $i['symbol'], 'name' => $i['name'], 'kind' => $i['kind'], 'days' => $days, 'last_updated' => $last];
        }, Nifty50::all());

        return ['symbols' => $symbols];
    }

    /** Last 30 trading days for a symbol, each with its stored-data status. */
    public function days(string $symbol): JsonResponse
    {
        $symbol = strtoupper($symbol);
        if (! Nifty50::isValid($symbol)) {
            return response()->json(['message' => 'Unknown symbol.'], 404);
        }

        $stored = collect();
        if (CandleTable::exists($symbol)) {
            $stored = DB::table(CandleTable::name($symbol))
                ->selectRaw('trade_date, COUNT(*) minutes, MAX(updated_at) updated_at')
                ->groupBy('trade_date')->get()->keyBy(fn ($r) => (string) $r->trade_date);
        }

        $days = [];
        $d = CarbonImmutable::now('Asia/Kolkata');
        while (count($days) < self::WINDOW) {
            if (! $d->isWeekend()) {
                $key = $d->format('Y-m-d');
                $row = $stored[$key] ?? null;
                $days[] = ['date' => $key, 'label' => $d->format('D, d M Y'), 'minutes' => (int) ($row->minutes ?? 0), 'updated_at' => $row->updated_at ?? null];
            }
            $d = $d->subDay();
        }

        return response()->json(['symbol' => $symbol, 'name' => Nifty50::map()[$symbol]['name'], 'days' => $days]);
    }

    /** Pull/refresh one or more days for a symbol. */
    public function update(Request $r, HistoryService $history): JsonResponse
    {
        $data = $r->validate([
            'symbol' => 'required|string|max:30',
            'dates' => 'required|array|min:1|max:'.self::MAX_DAYS,
            'dates.*' => 'required|date_format:Y-m-d',
        ]);
        $symbol = strtoupper($data['symbol']);
        if (! Nifty50::isValid($symbol)) {
            return response()->json(['message' => 'Unknown symbol.'], 404);
        }

        $results = [];
        $total = 0;
        foreach (array_unique($data['dates']) as $date) {
            $d = CarbonImmutable::parse($date, 'Asia/Kolkata');
            if ($d->isWeekend() || $d->isFuture() || $d->lt(CarbonImmutable::now()->subDays(90))) {
                $results[$date] = ['ok' => false, 'reason' => 'not a valid trading day'];
                continue;
            }
            $res = $history->updateDay($symbol, $date);
            $results[$date] = ['ok' => $res['minutes'] > 0, 'minutes' => $res['minutes'], 'buckets' => $res['buckets']];
            $total += $res['minutes'];
        }

        AuditLog::record('history_update', null, ['symbol' => $symbol, 'days' => count($data['dates']), 'minutes' => $total]);

        return response()->json(['symbol' => $symbol, 'results' => $results]);
    }

    /** Erase every instrument's candles table at once. Super Admin only; type-to-confirm. */
    public function eraseAll(Request $r): JsonResponse
    {
        if (! $r->user()->isSuper()) {
            return response()->json(['message' => 'Only a Super Admin can erase all data.'], 403);
        }
        $r->validate(['confirm' => 'required|string']);
        if (trim($r->input('confirm')) !== 'I UNDERSTAND') {
            return response()->json(['message' => 'Type I UNDERSTAND to confirm.'], 422);
        }

        $count = 0;
        foreach (Nifty50::all() as $i) {
            if (CandleTable::exists($i['symbol'])) {
                CandleTable::truncate($i['symbol']);
                $count++;
            }
        }
        AuditLog::record('history_erase_all', null, ['tables' => $count]);

        return response()->json(['message' => "Erased all candle data across $count tables."]);
    }

    /** Erase a symbol's entire candles table (keeps the empty table). */
    public function erase(string $symbol): JsonResponse
    {
        $symbol = strtoupper($symbol);
        if (! Nifty50::isValid($symbol)) {
            return response()->json(['message' => 'Unknown symbol.'], 404);
        }
        CandleTable::truncate($symbol);
        AuditLog::record('history_erase', null, ['symbol' => $symbol]);

        return response()->json(['message' => "Erased all stored data for $symbol."]);
    }
}
