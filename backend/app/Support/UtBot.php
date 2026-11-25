<?php

namespace App\Support;

/**
 * UT Bot Alerts (Key Value = 1, ATR Period = 10), ported from the dhan5/dhan6 Python code
 * (indicators_ut.py). Computes the ATR trailing stop, position (-1/0/1) and BUY/SELL signal
 * for a series of OHLC bars. Same math used for the 1-min and 5-min timeframes.
 */
class UtBot
{
    /** Wilder's ATR. $bars: list of ['high','low','close']. */
    public static function wilderAtr(array $bars, int $period): array
    {
        $n = count($bars);
        $atr = array_fill(0, $n, null);
        $trSum = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $h = $bars[$i]['high'];
            $l = $bars[$i]['low'];
            $pc = $i > 0 ? $bars[$i - 1]['close'] : $bars[$i]['close'];
            $tr = max($h - $l, abs($h - $pc), abs($l - $pc));
            if ($i < $period) {
                $trSum += $tr;
                if ($i === $period - 1) {
                    $atr[$i] = $trSum / $period;
                }
            } else {
                $atr[$i] = ($atr[$i - 1] * ($period - 1) + $tr) / $period;
            }
        }
        return $atr;
    }

    /**
     * Returns the input bars, each with added keys: atr_stop (?float), position (int -1/0/1),
     * signal (?'BUY'|'SELL').
     */
    public static function compute(array $bars, float $keyValue = 1, int $atrPeriod = 10): array
    {
        $n = count($bars);
        $atr = self::wilderAtr($bars, $atrPeriod);
        $stop = array_fill(0, $n, null);
        $pos = array_fill(0, $n, 0);
        $sig = array_fill(0, $n, null);

        for ($i = 0; $i < $n; $i++) {
            if ($atr[$i] === null) {
                $bars[$i] += ['atr_stop' => null, 'position' => 0, 'signal' => null];
                continue;
            }
            $nLoss = $keyValue * $atr[$i];
            $src = $bars[$i]['close'];

            if ($stop[$i - 1] === null) {
                $stop[$i] = $src - $nLoss;
                $bars[$i] += ['atr_stop' => $stop[$i], 'position' => 0, 'signal' => null];
                continue;
            }
            $prevStop = $stop[$i - 1];
            $prevSrc = $bars[$i - 1]['close'];

            if ($src > $prevStop && $prevSrc > $prevStop) {
                $stop[$i] = max($prevStop, $src - $nLoss);
            } elseif ($src < $prevStop && $prevSrc < $prevStop) {
                $stop[$i] = min($prevStop, $src + $nLoss);
            } elseif ($src > $prevStop) {
                $stop[$i] = $src - $nLoss;
            } else {
                $stop[$i] = $src + $nLoss;
            }

            if ($prevSrc < $prevStop && $src > $stop[$i]) {
                $pos[$i] = 1;
            } elseif ($prevSrc > $prevStop && $src < $stop[$i]) {
                $pos[$i] = -1;
            } else {
                $pos[$i] = $pos[$i - 1];
            }

            $above = $prevSrc <= $prevStop && $src > $stop[$i];
            $below = $prevSrc >= $prevStop && $src < $stop[$i];
            if ($src > $stop[$i] && $above) {
                $sig[$i] = 'BUY';
            } elseif ($src < $stop[$i] && $below) {
                $sig[$i] = 'SELL';
            }

            $bars[$i] += ['atr_stop' => $stop[$i], 'position' => $pos[$i], 'signal' => $sig[$i]];
        }
        return $bars;
    }
}
