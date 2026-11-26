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

    // Option underlying name (SM_SYMBOL_NAME in the scrip master) -> our index symbol.
    private const INDEX_OPT = [
        'NIFTY' => 'NIFTY 50',
        'BANKNIFTY' => 'BANKNIFTY',
        'SENSEX' => 'SENSEX',
    ];

    // Keep option expiries within this many days ahead so the chain table stays bounded.
    private const OPT_HORIZON_DAYS = 75;

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

        $now = now();
        $today = CarbonImmutable::now('Asia/Kolkata')->format('Y-m-d');
        $optHorizon = CarbonImmutable::now('Asia/Kolkata')->addDays(self::OPT_HORIZON_DAYS)->format('Y-m-d');

        // Allow-set for option underlyings: SM_SYMBOL_NAME -> our symbol (stocks, commodities, indices).
        $optAllow = [];
        foreach (array_keys($stocks) as $sym) {
            $optAllow[$sym] = $sym;
        }
        foreach (array_keys($commodities) as $sym) {
            $optAllow[$sym] = $sym;
        }
        foreach (self::INDEX_OPT as $name => $sym) {
            $optAllow[$name] = $sym;
        }

        $fh = fopen($tmp, 'r');
        fgetcsv($fh); // header
        $found = [];
        $futByComm = []; // symbol => [[secId, expiry, dhanSym], ...]
        $options = [];   // option_chain rows

        while (($row = fgetcsv($fh)) !== false) {
            [$exch, $seg, $secId, $inst, , $tsym, $lot, $custom, $expiry, $strike, $optType, , , , $series, $symName] = array_pad($row, 16, '');

            if ($exch === 'NSE' && $seg === 'E' && $inst === 'EQUITY' && $series === 'EQ' && isset($stocks[$tsym])) {
                $found[$tsym] = ['security_id' => $secId, 'segment' => 'NSE_EQ', 'instrument' => 'EQUITY', 'dhan_symbol' => $tsym, 'expiry' => null];
            } elseif ($exch === 'MCX' && $inst === 'FUTCOM' && isset($commodities[$symName])) {
                $futByComm[$symName][] = ['security_id' => $secId, 'expiry' => substr($expiry, 0, 10), 'dhan_symbol' => $tsym];
            } elseif (($inst === 'OPTSTK' || $inst === 'OPTIDX' || $inst === 'OPTFUT')
                && ($optType === 'CE' || $optType === 'PE')) {
                // Underlying comes from the human custom symbol ("EICHERMOT 26 NOV 8000 CALL"),
                // since SM_SYMBOL_NAME is empty/cryptic for stock & index options.
                $u = strtoupper(strtok($custom !== '' ? $custom : $symName, ' '));
                $exp = substr($expiry, 0, 10);
                if (isset($optAllow[$u]) && $exp >= $today && $exp <= $optHorizon) {
                    $segment = $exch === 'BSE' ? 'BSE_FNO' : ($exch === 'MCX' ? 'MCX_COMM' : 'NSE_FNO');
                    $options[] = [
                        'underlying' => $optAllow[$u],
                        'expiry' => $exp,
                        'strike' => (float) $strike,
                        'option_type' => $optType,
                        'security_id' => $secId,
                        'segment' => $segment,
                        'dhan_symbol' => $custom ?: $tsym,
                        'lot_size' => ((int) $lot) ?: null,
                        'updated_at' => $now,
                    ];
                }
            }
        }
        fclose($fh);
        @unlink($tmp);

        // Commodities: pick the nearest contract that hasn't expired yet.
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

        foreach ($found as $sym => $m) {
            DB::table('instrument_map')->updateOrInsert(['symbol' => $sym], $m + ['updated_at' => $now]);
        }

        // Rebuild the option chain. Stock options list on both NSE and BSE — prefer NSE (more
        // liquid, matches the terminal's NSE tag); keep BSE/MCX only where there's no NSE chain.
        $nseUnderlyings = [];
        foreach ($options as $o) {
            if ($o['segment'] === 'NSE_FNO') {
                $nseUnderlyings[$o['underlying']] = true;
            }
        }
        DB::table('option_chain')->truncate();
        $seen = [];
        $options = array_values(array_filter($options, function ($o) use (&$seen, $nseUnderlyings) {
            if ($o['segment'] === 'BSE_FNO' && isset($nseUnderlyings[$o['underlying']])) {
                return false; // drop BSE copy when an NSE chain exists for this underlying
            }
            if (isset($seen[$o['security_id']])) {
                return false;
            }
            $seen[$o['security_id']] = true;
            return true;
        }));
        foreach (array_chunk($options, 500) as $chunk) {
            DB::table('option_chain')->insert($chunk);
        }
        $optUnderlyings = count(array_unique(array_column($options, 'underlying')));
        $this->info('Imported '.count($options)." option contracts across $optUnderlyings underlyings.");

        $all = collect(Nifty50::all());
        $missing = $all->pluck('symbol')->reject(fn ($s) => isset($found[$s]));
        $this->info('Mapped '.count($found).' / '.$all->count().' instruments.');
        if ($missing->isNotEmpty()) {
            $this->warn('Unmapped (will use demo data): '.$missing->implode(', '));
        }

        return self::SUCCESS;
    }
}
