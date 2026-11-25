<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Each instrument gets its own candles_<symbol> table, so one symbol's data never bloats another's
 * and a table can be erased/refreshed independently. Schema matches a 1-minute bar with separate
 * 1-min and 5-min UT Bot flag columns.
 */
class CandleTable
{
    /** candles_eichermot, candles_mm, candles_nifty50, … (safe, unique per symbol). */
    public static function name(string $symbol): string
    {
        $suffix = strtolower(preg_replace('/[^A-Za-z0-9]/', '', $symbol));
        return 'candles_'.$suffix;
    }

    public static function exists(string $symbol): bool
    {
        return Schema::hasTable(self::name($symbol));
    }

    /** Create the table if missing. Returns the table name. */
    public static function ensure(string $symbol): string
    {
        $table = self::name($symbol);
        if (! Schema::hasTable($table)) {
            Schema::create($table, function (Blueprint $t) {
                $t->id();
                $t->date('trade_date');
                $t->dateTime('ts')->unique();   // 1-minute bar start (IST)
                $t->decimal('open', 12, 2);
                $t->decimal('high', 12, 2);
                $t->decimal('low', 12, 2);
                $t->decimal('close', 12, 2);
                $t->unsignedBigInteger('volume')->default(0);
                $t->decimal('atr_1m', 12, 2)->nullable();
                $t->tinyInteger('pos_1m')->default(0);
                $t->enum('signal_1m', ['BUY', 'SELL'])->nullable();
                $t->decimal('atr_5m', 12, 2)->nullable();
                $t->tinyInteger('pos_5m')->nullable();
                $t->enum('signal_5m', ['BUY', 'SELL'])->nullable();
                $t->timestamp('updated_at')->nullable();
                $t->index('trade_date');
            });
        }
        return $table;
    }

    /** Erase all rows (keeps the table). */
    public static function truncate(string $symbol): void
    {
        if (self::exists($symbol)) {
            DB::table(self::name($symbol))->truncate();
        }
    }

    public static function drop(string $symbol): void
    {
        Schema::dropIfExists(self::name($symbol));
    }
}
