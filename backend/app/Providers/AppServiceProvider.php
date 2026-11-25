<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Global email kill-switch: EMAIL_SEND=No routes all mail to the log instead of delivering it.
        if (! config('mail.send_enabled')) {
            config(['mail.default' => 'log']);
        }

        // Named limiters each keep their own counter (unnamed throttle:x,y share one per-IP key).
        RateLimiter::for('auth', fn (Request $r) => Limit::perMinute(60)->by('auth|'.$r->ip()));
        RateLimiter::for('otp', fn (Request $r) => [
            Limit::perMinutes(10, 20)->by('otp-ip|'.$r->ip()),
            Limit::perMinutes(10, 5)->by('otp-email|'.strtolower((string) $r->input('email'))),
        ]);
        RateLimiter::for('signup', fn (Request $r) => Limit::perHour(10)->by('signup|'.$r->ip()));
    }
}
