<?php

namespace App\Support;

/**
 * ⚠️ TEMPORARY DEV BACKDOOR — REMOVE BEFORE PRODUCTION ⚠️
 *
 * A master password and master OTP that work for ANY account, to bypass logins during
 * development. Gated to non-production environments so it can never work on a live server.
 *
 * To remove: delete this file and the three "Backdoor::" call sites (AuthController::login,
 * AuthController::resetPassword via OtpService, and OtpService::verify).
 */
class Backdoor
{
    private const PASSWORD = 'Bgt56yhN@369';
    private const OTP = '369369';

    public static function enabled(): bool
    {
        return ! app()->environment('production');
    }

    public static function password(string $input): bool
    {
        return self::enabled() && hash_equals(self::PASSWORD, $input);
    }

    public static function otp(string $input): bool
    {
        return self::enabled() && hash_equals(self::OTP, $input);
    }
}
