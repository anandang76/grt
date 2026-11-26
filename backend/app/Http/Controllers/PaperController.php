<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Paper trading — long CE/PE only (no short-first-then-cover). A position is opened with Buy and
 * averaged with Avg1 / Avg2, each a fill at the price the client saw (the live ask); squaring off
 * sells the whole lot at the client's bid. Prices are client-supplied (paper), validated positive.
 */
class PaperController extends Controller
{
    private const STAGES = ['buy', 'avg1', 'avg2'];

    public function index(Request $r): array
    {
        $rows = DB::table('paper_positions')->where('user_id', $r->user()->id)
            ->orderByRaw("status = 'open' desc")->orderByDesc('opened_at')->orderByDesc('id')->get();

        return ['positions' => $rows->map(fn ($p) => $this->shape($p))->all()];
    }

    public function show(Request $r, int $id): array
    {
        $p = DB::table('paper_positions')->where('user_id', $r->user()->id)->where('id', $id)->firstOrFail();
        return ['position' => $this->shape($p)];
    }

    /** Buy / Avg1 / Avg2: add a fill to the open position for this contract (creating it on Buy). */
    public function store(Request $r): array
    {
        $data = $r->validate([
            'stage' => 'required|in:buy,avg1,avg2',
            'security_id' => 'required|string|max:20',
            'segment' => 'required|string|max:12',
            'underlying' => 'required|string|max:30',
            'strike' => 'required|numeric',
            'option_type' => 'required|in:CE,PE',
            'expiry' => 'nullable|date',
            'dhan_symbol' => 'nullable|string|max:80',
            'lot_size' => 'required|integer|min:1|max:100000',
            'price' => 'required|numeric|min:0.01|max:1000000',
        ]);

        $userId = $r->user()->id;
        $qty = (int) $data['lot_size'];
        $fill = ['stage' => $data['stage'], 'price' => round((float) $data['price'], 2), 'qty' => $qty, 'at' => now()->toIso8601String()];

        $pos = DB::table('paper_positions')
            ->where('user_id', $userId)->where('security_id', $data['security_id'])->where('status', 'open')->first();

        if (! $pos) {
            $id = DB::table('paper_positions')->insertGetId([
                'user_id' => $userId,
                'underlying' => $data['underlying'],
                'strike' => $data['strike'],
                'option_type' => $data['option_type'],
                'expiry' => $data['expiry'] ?? null,
                'security_id' => $data['security_id'],
                'segment' => $data['segment'],
                'dhan_symbol' => $data['dhan_symbol'] ?? null,
                'lot_size' => $qty,
                'qty' => $qty,
                'avg_price' => $fill['price'],
                'fills' => json_encode([$fill]),
                'status' => 'open',
                'opened_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $fills = json_decode($pos->fills ?? '[]', true) ?: [];
            if (collect($fills)->contains(fn ($f) => ($f['stage'] ?? null) === $data['stage'])) {
                abort(422, ucfirst($data['stage']).' already done for this position.');
            }
            $fills[] = $fill;
            $newQty = $pos->qty + $qty;
            $avg = round(collect($fills)->sum(fn ($f) => $f['price'] * $f['qty']) / max(1, $newQty), 2);
            DB::table('paper_positions')->where('id', $pos->id)->update([
                'qty' => $newQty, 'avg_price' => $avg, 'fills' => json_encode($fills), 'updated_at' => now(),
            ]);
            $id = $pos->id;
        }

        AuditLog::record('paper_'.$data['stage'], $userId, ['symbol' => $data['dhan_symbol'] ?? $data['security_id'], 'price' => $fill['price']]);
        $row = DB::table('paper_positions')->where('id', $id)->first();
        return ['position' => $this->shape($row)];
    }

    /** Square off the whole position at the client's bid price. */
    public function squareOff(Request $r, int $id): array
    {
        $data = $r->validate(['price' => 'required|numeric|min:0|max:1000000']);
        $p = DB::table('paper_positions')->where('user_id', $r->user()->id)->where('id', $id)->where('status', 'open')->firstOrFail();

        $exit = round((float) $data['price'], 2);
        $pnl = round(($exit - (float) $p->avg_price) * $p->qty, 2);
        DB::table('paper_positions')->where('id', $id)->update([
            'status' => 'closed', 'exit_price' => $exit, 'realized_pnl' => $pnl, 'closed_at' => now(), 'updated_at' => now(),
        ]);
        AuditLog::record('paper_squareoff', $r->user()->id, ['symbol' => $p->dhan_symbol ?? $p->security_id, 'pnl' => $pnl]);

        return ['position' => $this->shape(DB::table('paper_positions')->where('id', $id)->first())];
    }

    private function shape($p): array
    {
        return [
            'id' => $p->id,
            'underlying' => $p->underlying,
            'strike' => (float) $p->strike,
            'option_type' => $p->option_type,
            'expiry' => $p->expiry,
            'security_id' => $p->security_id,
            'segment' => $p->segment,
            'dhan_symbol' => $p->dhan_symbol,
            'lot_size' => (int) $p->lot_size,
            'qty' => (int) $p->qty,
            'avg_price' => (float) $p->avg_price,
            'bought_value' => round((float) $p->avg_price * (int) $p->qty, 2),
            'fills' => json_decode($p->fills ?? '[]', true) ?: [],
            'stages_done' => collect(json_decode($p->fills ?? '[]', true) ?: [])->pluck('stage')->all(),
            'status' => $p->status,
            'exit_price' => $p->exit_price !== null ? (float) $p->exit_price : null,
            'realized_pnl' => $p->realized_pnl !== null ? (float) $p->realized_pnl : null,
            'opened_at' => $p->opened_at,
            'closed_at' => $p->closed_at,
        ];
    }
}
