<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Paper-trading positions: long CE/PE only (no short-first). A position is opened with Buy
        // and averaged with Avg1/Avg2 (each a fill at the live ask), then squared off at the bid.
        Schema::create('paper_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('underlying', 30);
            $table->decimal('strike', 14, 2);
            $table->char('option_type', 2);          // CE | PE
            $table->date('expiry')->nullable();
            $table->string('security_id', 20);
            $table->string('segment', 12);
            $table->string('dhan_symbol', 80)->nullable();
            $table->unsignedInteger('lot_size')->default(1);

            $table->unsignedInteger('qty')->default(0);   // total units held
            $table->decimal('avg_price', 14, 2)->default(0);
            $table->json('fills')->nullable();            // [{stage, price, qty, at}]
            $table->string('status', 10)->default('open'); // open | closed
            $table->decimal('exit_price', 14, 2)->nullable();
            $table->decimal('realized_pnl', 16, 2)->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'security_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paper_positions');
    }
};
