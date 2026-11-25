<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Our symbol -> Dhan identifiers (from the scrip master). Populated by grt:import-instruments.
        Schema::create('instrument_map', function (Blueprint $table) {
            $table->string('symbol', 30)->primary();
            $table->string('security_id', 20);
            $table->string('segment', 12);       // NSE_EQ, BSE_EQ, IDX_I, MCX_COMM
            $table->string('instrument', 12);     // EQUITY, INDEX, FUTCOM
            $table->string('dhan_symbol', 60)->nullable();
            $table->date('expiry')->nullable();   // for commodity futures
            $table->timestamp('updated_at')->nullable();
        });

        // Cached quote stats for the config screen (LTP, 52-week / 5-day / 1-day high-low-%).
        // Filled from Dhan daily history by the refresh cron; falls back to demo if absent.
        Schema::create('instrument_stats', function (Blueprint $table) {
            $table->string('symbol', 30)->primary();
            $table->decimal('ltp', 14, 2)->nullable();
            $table->decimal('w52_high', 14, 2)->nullable();
            $table->decimal('w52_low', 14, 2)->nullable();
            $table->decimal('w52_pct', 8, 2)->nullable();
            $table->decimal('d5_high', 14, 2)->nullable();
            $table->decimal('d5_low', 14, 2)->nullable();
            $table->decimal('d5_pct', 8, 2)->nullable();
            $table->decimal('d1_high', 14, 2)->nullable();
            $table->decimal('d1_low', 14, 2)->nullable();
            $table->decimal('d1_pct', 8, 2)->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instrument_map');
        Schema::dropIfExists('instrument_stats');
    }
};
