<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-user watchlist (5–10 NIFTY 50 symbols shown in the left menu).
        Schema::create('watchlist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('symbol', 30);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'symbol']);
            $table->index(['user_id', 'sort']);
        });

        // Shared key/value settings (e.g. the daily Dhan API token).
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 50)->primary();
            $table->text('value')->nullable();
            $table->string('updated_by_name', 100)->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watchlist_items');
        Schema::dropIfExists('settings');
    }
};
