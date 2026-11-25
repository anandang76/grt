<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per 1-minute bar. 1-min and 5-min UT Bot flags live in SEPARATE columns:
        // the *_1m columns are set on every row; the *_5m columns are set only on the row that
        // begins each 5-minute bucket (null on the other four).
        Schema::create('candles', function (Blueprint $table) {
            $table->id();
            $table->string('symbol', 30);
            $table->date('trade_date');
            $table->dateTime('ts');              // 1-minute bar start (IST)
            $table->decimal('open', 12, 2);
            $table->decimal('high', 12, 2);
            $table->decimal('low', 12, 2);
            $table->decimal('close', 12, 2);
            $table->unsignedBigInteger('volume')->default(0);

            // 1-minute UT Bot
            $table->decimal('atr_1m', 12, 2)->nullable();
            $table->tinyInteger('pos_1m')->default(0);
            $table->enum('signal_1m', ['BUY', 'SELL'])->nullable();

            // 5-minute UT Bot (only on 5-min bucket-start rows)
            $table->decimal('atr_5m', 12, 2)->nullable();
            $table->tinyInteger('pos_5m')->nullable();
            $table->enum('signal_5m', ['BUY', 'SELL'])->nullable();

            $table->timestamp('updated_at')->nullable();

            $table->unique(['symbol', 'ts']);
            $table->index(['symbol', 'trade_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candles');
    }
};
