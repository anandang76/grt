<?php

use App\Support\CandleTable;
use App\Support\Nifty50;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Replace the single shared candles table with one table per instrument.
        Schema::dropIfExists('candles');
        foreach (Nifty50::all() as $i) {
            CandleTable::ensure($i['symbol']);
        }
    }

    public function down(): void
    {
        foreach (Nifty50::all() as $i) {
            CandleTable::drop($i['symbol']);
        }
    }
};
