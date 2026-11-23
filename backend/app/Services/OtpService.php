<?php

namespace App\Services;

use App\Mail\SimpleMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/** 6-digit email codes for login and password reset. 10 min expiry, 5 tries, 60 s resend cooldown. */
class OtpService
{
    public const PURPOSES = ['login', 'reset'];

    private function hash(string $email, string $purpose, string $code): string
    {
        return hash_hmac('sha256', "$email|$purpose|$code", config('app.key'));
    }

    /** @return 'sent'|'wait'|'fail' */
    public function send(string $email, string $purpose): string
    {
        $last = DB::table('otps')->where(compact('email', 'purpose'))->latest('id')->value('created_at');
        if ($last && now()->subMinute()->lt($last)) {
            return 'wait';
        }

        DB::table('otps')->where('created_at', '<', now()->subDay())->delete();
        DB::table('otps')->where(compact('email', 'purpose'))->whereNull('used_at')->update(['used_at' => now()]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::table('otps')->insert([
            'email' => $email,
            'purpose' => $purpose,
            'code_hash' => $this->hash($email, $purpose, $code),
            'expires_at' => now()->addMinutes(10),
            'created_at' => now(),
        ]);

        $what = $purpose === 'reset' ? 'reset your password' : 'log in';
        try {
            Mail::to($email)->send(new SimpleMail(
                "$code is your ".config('app.name').' code',
                'Your verification code',
                "<p>Use this code to $what:</p>"
                .'<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">'.$code.'</p>'
                .'<p style="color:#666">It expires in 10 minutes. If you did not request this, you can ignore this email.</p>'
            ));
        } catch (\Throwable $e) {
            Log::error('OTP mail failed: '.$e->getMessage());
            return 'fail';
        }

        return 'sent';
    }

    public function verify(string $email, string $purpose, string $code): bool
    {
        $row = DB::table('otps')->where(compact('email', 'purpose'))->whereNull('used_at')->latest('id')->first();
        if (! $row || now()->gt($row->expires_at) || $row->attempts >= 5 || ! preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        if (hash_equals($row->code_hash, $this->hash($email, $purpose, $code))) {
            DB::table('otps')->where('id', $row->id)->update(['used_at' => now()]);
            return true;
        }
        DB::table('otps')->where('id', $row->id)->increment('attempts');
        return false;
    }
}
