<?php

use App\Http\Controllers\Admin\HistoryController;
use App\Http\Controllers\Admin\MasterListController;
use App\Http\Controllers\Admin\SystemController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BrokerController;
use App\Http\Controllers\CandlesController;
use App\Http\Controllers\OptionsController;
use App\Http\Controllers\PaperController;
use App\Http\Controllers\WatchlistController;
use App\Services\TickerToken;
use App\Support\DhanCredentials;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Public settings the SPA needs at boot.
Route::get('/config', fn () => [
    'app_name' => config('app.name'),
    'google_client_id' => config('services.google.client_id') ?: null,
]);

// Internal: the Node tick service fetches the Dhan token + securityId map here.
// Authenticated by the shared TICKER_SECRET (not a user), never exposed to the browser.
Route::get('/ticker/feed-config', function (Request $r) {
    if (! hash_equals((string) config('services.ticker.secret'), (string) $r->header('X-Ticker-Secret'))) {
        abort(403);
    }
    $c = DhanCredentials::current();
    $instruments = DB::table('instrument_map')->get()
        ->mapWithKeys(fn ($m) => [$m->symbol => ['securityId' => $m->security_id, 'segment' => $m->segment]]);

    // Only hand the ticker a token while it's within its 18-hour window. When stale we return a
    // null token so the feed stays idle (no Dhan auth attempts / reconnect noise) — the charts
    // then serve stored history only until someone updates the token.
    return ['token' => $c['ready'] ? $c['token'] : null, 'clientId' => $c['ready'] ? $c['client_id'] : null, 'instruments' => $instruments];
});

Route::prefix('auth')->name('auth.')->controller(AuthController::class)->group(function () {
    Route::get('/me', 'me')->name('me');

    Route::middleware('throttle:auth')->group(function () {
        Route::post('/login', 'login');
        Route::post('/otp/send', 'otpSend')->middleware('throttle:otp');
        Route::post('/otp/login', 'otpLogin');
        Route::post('/password/reset', 'resetPassword');
        Route::post('/signup', 'signup')->middleware('throttle:signup');
        Route::post('/google', 'google');
    });

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('/logout', 'logout')->name('logout');
        Route::post('/password', 'changePassword')->name('password');
    });
});

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Short-lived token for the Node tick service (WebSocket).
    Route::get('/ticker/token', fn (Request $r) => [
        'token' => TickerToken::issue($r->user()),
        'url' => config('services.ticker.url'),
    ]);

    // Watchlist (user manages their own) + NIFTY 50 reference list.
    Route::get('/watchlist', [WatchlistController::class, 'index']);
    Route::put('/watchlist', [WatchlistController::class, 'update']);
    Route::get('/instruments', [WatchlistController::class, 'instruments']);
    Route::get('/candles/{symbol}', [CandlesController::class, 'show']);
    Route::get('/options/{symbol}', [OptionsController::class, 'chain'])->where('symbol', '.*');

    // Paper trading (long CE/PE only).
    Route::get('/paper/positions', [PaperController::class, 'index']);
    Route::get('/paper/positions/{id}', [PaperController::class, 'show']);
    Route::post('/paper/positions', [PaperController::class, 'store']);
    Route::post('/paper/positions/{id}/squareoff', [PaperController::class, 'squareOff']);

    // Shared Dhan API credentials — any logged-in user may view and update.
    // Client ID is set once; the access token is re-entered daily — updated separately.
    Route::get('/broker/dhan', [BrokerController::class, 'show']);
    Route::put('/broker/dhan/client-id', [BrokerController::class, 'updateClientId']);
    Route::put('/broker/dhan/token', [BrokerController::class, 'updateToken']);
});

Route::middleware(['auth:sanctum', 'active:admin,superadmin'])->prefix('admin')->group(function () {
    Route::get('/stats', [UserController::class, 'stats']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::post('/users/{user}/action', [UserController::class, 'action']);
    Route::put('/users/{user}/watchlist', [UserController::class, 'setWatchlist']);

    // Weekly master list: the <=10 scripts enabled for the dry run (users pick from these).
    Route::get('/master-list', [MasterListController::class, 'show']);
    Route::put('/master-list', [MasterListController::class, 'update']);

    // History data tool: pull & store intraday candles per script/day.
    Route::get('/history/symbols', [HistoryController::class, 'symbols']);
    Route::get('/history/days/{symbol}', [HistoryController::class, 'days']);
    Route::post('/history/update', [HistoryController::class, 'update']);
    Route::post('/history/erase-all', [HistoryController::class, 'eraseAll']);
    Route::delete('/history/{symbol}', [HistoryController::class, 'erase']);

    Route::middleware('active:superadmin')->group(function () {
        Route::get('/roles', [SystemController::class, 'roles']);
        Route::get('/audit', [SystemController::class, 'audit']);
    });
});
