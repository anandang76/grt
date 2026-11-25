<?php

use App\Models\User;
use App\Support\CandleTable;
use App\Support\Nifty50;
use App\Support\Phone;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

// php artisan grt:superadmin            (interactive)
// php artisan grt:superadmin a@b.com --name="Name" --phone=98xxxxxxxx --password=Secret123
Artisan::command('grt:superadmin {email?} {--name=} {--phone=} {--password=}', function () {
    $email = strtolower(trim($this->argument('email') ?: text('Email', required: true, validate: fn ($v) => filter_var($v, FILTER_VALIDATE_EMAIL) ? null : 'Invalid email')));
    $name = $this->option('name') ?: text('Full name', default: 'Super Admin');
    $phone = Phone::normalize($this->option('phone') ?? ($this->input->isInteractive() ? text('Mobile (optional)') : ''));
    $pw = $this->option('password') ?: password('Password (8+ chars, letters and numbers)', required: true,
        validate: fn ($v) => strlen($v) >= 8 && preg_match('/[A-Za-z]/', $v) && preg_match('/\d/', $v) ? null : 'Too weak');

    $user = User::firstOrNew(['email' => $email]);
    $user->forceFill([
        'name' => $user->exists ? $user->name : $name,
        'phone' => $user->phone ?? $phone,
        'password' => $pw,
        'role' => 'superadmin',
        'status' => 'active',
        'must_change_password' => false,
        'email_verified_at' => $user->email_verified_at ?? now(),
        'terms_accepted_at' => $user->terms_accepted_at ?? now(),
        'approved_at' => $user->approved_at ?? now(),
    ])->save();

    $this->info(($user->wasRecentlyCreated ? 'Created' : 'Updated')." Super Admin: $email");
})->purpose('Create or promote a Super Admin');

// Create a candles_<symbol> table for any instrument that doesn't have one yet.
// Run after adding new symbols (e.g. Next NIFTY 50) to config/nifty50.php.
Artisan::command('grt:candle-tables', function () {
    $made = 0;
    foreach (Nifty50::all() as $i) {
        if (! CandleTable::exists($i['symbol'])) {
            CandleTable::ensure($i['symbol']);
            $this->line('  created '.CandleTable::name($i['symbol']));
            $made++;
        }
    }
    $this->info($made ? "Created $made candle table(s)." : 'All candle tables already exist.');
})->purpose('Create missing per-symbol candle tables');

// Daily data refresh (cron). Runs via Laravel's scheduler if you cron `schedule:run`,
// or schedule `grt:refresh-history` directly in your VPS crontab (see README).
Schedule::command('grt:refresh-history')->timezone('Asia/Kolkata')->dailyAt('16:00')->withoutOverlapping();
Schedule::command('grt:refresh-history')->timezone('Asia/Kolkata')->dailyAt('23:00')->withoutOverlapping();

// Keep today's candles current in the DB for open-market watchlist symbols (every 5 min).
Schedule::command('grt:live-refresh')->everyFiveMinutes()->withoutOverlapping();
