<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Option contracts for our underlyings (from the scrip master), used by the
        // option-strike ladder + depth panel. Populated by grt:import-instruments.
        Schema::create('option_chain', function (Blueprint $table) {
            $table->id();
            $table->string('underlying', 30);          // our symbol, e.g. EICHERMOT / NIFTY 50
            $table->date('expiry');
            $table->decimal('strike', 14, 2);
            $table->char('option_type', 2);            // CE | PE
            $table->string('security_id', 20);
            $table->string('segment', 12);             // NSE_FNO, BSE_FNO, MCX_COMM
            $table->string('dhan_symbol', 80)->nullable(); // custom label, e.g. "EICHERMOT 29 DEC 8300 PUT"
            $table->unsignedInteger('lot_size')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->index(['underlying', 'expiry', 'strike']);
            $table->unique('security_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('option_chain');
    }
};
