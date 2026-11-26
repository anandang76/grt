<?php

namespace App\Http\Controllers;

use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class OptionsController extends Controller
{
    /**
     * Option-strike ladder for an underlying: the nearest non-expired expiry and every strike on
     * it, each with its CALL/PUT securityId + segment so the browser can subscribe them live and
     * re-centre the ladder around the live spot price.
     *
     *   GET /api/options/{symbol}
     */
    public function chain(string $symbol)
    {
        $symbol = urldecode($symbol);
        if (! Nifty50::isValid($symbol)) {
            abort(404);
        }

        $rows = DB::table('option_chain')->where('underlying', $symbol)->orderBy('expiry')->orderBy('strike')->get();
        if ($rows->isEmpty()) {
            return ['underlying' => $symbol, 'expiry' => null, 'expiries' => [], 'strikes' => []];
        }

        $today = CarbonImmutable::now('Asia/Kolkata')->format('Y-m-d');
        $expiries = $rows->pluck('expiry')->unique()->sort()->values();
        $expiry = $expiries->first(fn ($e) => $e >= $today) ?? $expiries->first();

        $byStrike = [];
        foreach ($rows->where('expiry', $expiry) as $o) {
            $k = (string) $o->strike;
            $byStrike[$k]['strike'] = (float) $o->strike;
            $byStrike[$k]['lot'] = $o->lot_size !== null ? (int) $o->lot_size : null;
            $leg = $o->option_type === 'CE' ? 'ce' : 'pe';
            $byStrike[$k][$leg] = [
                'securityId' => $o->security_id,
                'segment' => $o->segment,
                'dhanSymbol' => $o->dhan_symbol,
            ];
        }
        $strikes = array_values($byStrike);
        usort($strikes, fn ($a, $b) => $a['strike'] <=> $b['strike']);

        return [
            'underlying' => $symbol,
            'expiry' => $expiry,
            'expiries' => $expiries->all(),
            'strikes' => $strikes,
        ];
    }
}
