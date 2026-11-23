<?php

use App\Http\Controllers\Admin\SystemController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AuthController;
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
});

Route::middleware(['auth:sanctum', 'active:admin,superadmin'])->prefix('admin')->group(function () {
    Route::get('/stats', [UserController::class, 'stats']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::post('/users/{user}/action', [UserController::class, 'action']);

    Route::middleware('active:superadmin')->group(function () {
        Route::get('/roles', [SystemController::class, 'roles']);
        Route::get('/audit', [SystemController::class, 'audit']);
    });
});
