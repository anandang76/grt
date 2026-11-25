<?php

namespace App\Console\Commands;

use App\Support\Nifty50;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Download Dhan's scrip master and map our instrument symbols to their Dhan securityId / segment /
 * instrument type, storing the result in instrument_map. Run once (and whenever symbols change).
 *
 *   php artisan grt:import-instruments
 */
class ImportInstruments extends Command
{
    protected $signature = 'grt:import-instruments';

    protected $description = 'Map instruments to Dhan securityIds from the scrip master';

    private const CSV = 'https://images.dhan.co/api-data/api-scrip-master.csv';

    // Indices aren't matched by trading symbol cleanly, so map them explicitly.
    private const INDICES = [
        'NIFTY 50' => ['13', 'IDX_I', 'INDEX'],
        'BANKNIFTY' => ['25', 'IDX_I', 'INDEX'],
        'SENSEX' => ['51', 'IDX_I', 'INDEX'],
        // GIFTNIFTY is not in the NSE scrip master → left unmapped (demo data).
    ];

    public function handle(): int
    {
        $stocks = [];       // symbol => true (NSE equity)
        $commodities = [];  // symbol => true (MCX FUTCOM, nearest expiry)
        foreach (Nifty50::all() as $i) {
            if ($i['kind'] === 'stock') {
                $stocks[$i['symbol']] = true;
            } elseif ($i['kind'] === 'commodity') {
                $commodities[$i['symbol']] = true;
            }
        }

        $tmp = tempnam(sys_get_temp_dir(), 'scrip');
        $this->info('Downloading scrip master…');
        $res = Http::timeout(120)->sink($tmp)->get(self::CSV);
        if (! $res->ok()) {
            @unlink($tmp);
            $this->error('Download failed: HTTP '.$res->status());
            return self::FAILURE;
        }

        $fh = fopen($tmp, 'r');
        fgetcsv($fh); // header
        $found = [];
        $futByComm = []; // symbol => [[secId, expiry, dhanSym], ...]

        while (($row = fgetcsv($fh)) !== false) {
            [$exch, $seg, $secId, $inst, , $tsym, , , $expiry, , , , , , $series, $symName] = array_pad($row, 16, '');

            if ($exch === 'NSE' && $seg === 'E' && $inst === 'EQUITY' && $series === 'EQ' && isset($stocks[$tsym])) {
                $found[$tsym] = ['security_id' => $secId, 'segment' => 'NSE_EQ', 'instrument' => 'EQUITY', 'dhan_symbol' => $tsym, 'expiry' => null];
            } elseif ($exch === 'MCX' && $inst === 'FUTCOM' && isset($commodities[$symName])) {
                $futByComm[$symName][] = ['security_id' => $secId, 'expiry' => substr($expiry, 0, 10), 'dhan_symbol' => $tsym];
            }
        }
        fclose($fh);
        @unlink($tmp);

        // Commodities: pick the nearest contract that hasn't expired yet.
        $today = CarbonImmutable::now('Asia/Kolkata')->format('Y-m-d');
        foreach ($futByComm as $sym => $contracts) {
            $future = array_filter($contracts, fn ($c) => $c['expiry'] >= $today);
            usort($future, fn ($a, $b) => strcmp($a['expiry'], $b['expiry']));
            $pick = $future[0] ?? null;
            if ($pick) {
                $found[$sym] = ['security_id' => $pick['security_id'], 'segment' => 'MCX_COMM', 'instrument' => 'FUTCOM', 'dhan_symbol' => $pick['dhan_symbol'], 'expiry' => $pick['expiry']];
            }
        }

        // Indices (explicit).
        foreach (self::INDICES as $sym => [$secId, $segment, $inst]) {
            $found[$sym] = ['security_id' => $secId, 'segment' => $segment, 'instrument' => $inst, 'dhan_symbol' => $sym, 'expiry' => null];
        }

        $now = now();
        foreach ($found as $sym => $m) {
            DB::table('instrument_map')->updateOrInsert(['symbol' => $sym], $m + ['updated_at' => $now]);
        }

        $all = collect(Nifty50::all());
        $missing = $all->pluck('symbol')->reject(fn ($s) => isset($found[$s]));
        $this->info('Mapped '.count($found).' / '.$all->count().' instruments.');
        if ($missing->isNotEmpty()) {
            $this->warn('Unmapped (will use demo data): '.$missing->implode(', '));
        }

        return self::SUCCESS;
    }
}
