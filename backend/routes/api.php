<?php

use App\Http\Controllers\Admin\HistoryController;
use App\Http\Controllers\Admin\SystemController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BrokerController;
use App\Http\Controllers\CandlesController;
use App\Http\Controllers\WatchlistController;
use App\Services\TickerToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public settings the SPA needs at boot.
Route::get('/config', fn () => [
    'app_name' => config('app.name'),
    'google_client_id' => config('services.google.client_id') ?: null,
]);

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
