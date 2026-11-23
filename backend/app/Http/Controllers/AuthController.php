<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\GoogleVerifier;
use App\Services\Notifier;
use App\Services\OtpService;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private OtpService $otp, private Notifier $notify) {}

    public function me(Request $r): array
    {
        $u = $r->user();
        return ['user' => $u && $u->status === 'active' ? $u->toSelf() : null];
    }

    public function login(Request $r): array
    {
        $data = $r->validate(['email' => 'required|email|max:190', 'password' => 'required|string|max:200']);
        $email = $this->email($data['email']);
        $this->throttle($email);

        $u = User::where('email', $email)->first();
        if (! $u || ! $u->password || ! Hash::check($data['password'], $u->password)) {
            $this->failed($email);
            $this->error($u && ! $u->password
                ? 'This account has no password yet. Use Email OTP or Google to log in.'
                : 'Incorrect email or password.');
        }
        return $this->complete($r, $u, $email, 'password');
    }

    public function otpSend(Request $r): JsonResponse
    {
        $data = $r->validate(['email' => 'required|email|max:190', 'purpose' => 'required|in:login,reset']);
        $email = $this->email($data['email']);

        // Same answer whether or not the account exists.
        $res = User::where('email', $email)->exists() ? $this->otp->send($email, $data['purpose']) : 'sent';
        return match ($res) {
            'wait' => response()->json(['message' => 'A code was just sent. Please wait a minute before requesting another.'], 429),
            'fail' => response()->json(['message' => 'We could not send the email right now. Please try again shortly.'], 503),
            default => response()->json(['message' => "If an account exists for $email, we have sent a 6-digit code."]),
        };
    }

    public function otpLogin(Request $r): array
    {
        $data = $r->validate(['email' => 'required|email|max:190', 'code' => 'required|string']);
        $email = $this->email($data['email']);
        $this->throttle($email);

        $u = User::where('email', $email)->first();
        if (! $u || ! $this->otp->verify($email, 'login', preg_replace('/\D/', '', $data['code']))) {
            $this->failed($email);
            $this->error('Invalid or expired code.', 'code');
        }
        if (! $u->email_verified_at) {
            $u->forceFill(['email_verified_at' => now()])->save();
        }
        return $this->complete($r, $u, $email, 'otp');
    }

    public function resetPassword(Request $r): array
    {
        $data = $r->validate([
            'email' => 'required|email|max:190',
            'code' => 'required|string',
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $email = $this->email($data['email']);
        $this->throttle($email);

        $u = User::where('email', $email)->first();
        if (! $u || ! $this->otp->verify($email, 'reset', preg_replace('/\D/', '', $data['code']))) {
            $this->failed($email);
            $this->error('Invalid or expired code.', 'code');
        }
        $u->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
            'email_verified_at' => $u->email_verified_at ?? now(),
        ])->save();
        AuditLog::record('password_reset_self', $u->id, [], $u->id);
        RateLimiter::clear('login:'.$email);

        return ['message' => 'Your password has been updated. Please log in.'];
    }

    public function signup(Request $r): array
    {
        $r->merge(['email' => $this->email((string) $r->input('email'))]);
        $data = $r->validate([
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|email|max:190|unique:users,email',
            'phone' => ['required', 'string', 'max:20', function ($attr, $value, $fail) {
                if (! Phone::normalize($value)) {
                    $fail('Enter a valid 10-digit Indian mobile number.');
                }
            }],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'terms' => 'accepted',
        ], [
            'email.unique' => 'An account with this email already exists. Please log in.',
            'terms.accepted' => 'You must accept the Terms & Conditions.',
        ]);
        $phone = Phone::normalize($data['phone']);

        $u = User::create([
            'name' => trim($data['name']),
            'email' => $data['email'],
            'phone' => $phone,
            'password' => $data['password'],
            'terms_accepted_at' => now(),
        ]);
        AuditLog::record('signup', $u->id, ['via' => 'form'], $u->id);
        $this->notify->signupReceived($u);

        return ['message' => 'Signup received. Your account is awaiting admin approval.'];
    }

    public function google(Request $r, GoogleVerifier $google): array
    {
        $data = $r->validate(['credential' => 'required|string', 'mode' => 'required|in:signin,signup', 'phone' => 'nullable|string|max:20', 'terms' => 'nullable']);
        $claims = $google->verify($data['credential']) ?? $this->error('Google sign-in failed. Please try again.');
        $email = $this->email($claims['email']);

        if ($u = User::where('email', $email)->first()) {
            if ($u->google_id && $u->google_id !== $claims['sub']) {
                $this->error('This email is linked to a different Google account.');
            }
            if (! $u->google_id) {
                $u->forceFill(['google_id' => $claims['sub'], 'email_verified_at' => $u->email_verified_at ?? now()])->save();
            }
            return $this->complete($r, $u, $email, 'google');
        }

        if ($data['mode'] !== 'signup') {
            $this->error("No account found for $email. Please sign up first.");
        }
        if (! filter_var($data['terms'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $this->error('Please accept the Terms & Conditions to sign up.', 'terms');
        }
        $phone = Phone::normalize($data['phone'] ?? '') ?? $this->error('Enter a valid 10-digit mobile number, then continue with Google.', 'phone');

        $u = User::create([
            'name' => mb_substr(trim($claims['name'] ?? '') ?: strstr($email, '@', true), 0, 100),
            'email' => $email,
            'phone' => $phone,
            'google_id' => $claims['sub'],
            'email_verified_at' => now(),
            'terms_accepted_at' => now(),
        ]);
        AuditLog::record('signup', $u->id, ['via' => 'google'], $u->id);
        $this->notify->signupReceived($u);

        return ['signup' => true, 'message' => 'Signup received. Your account is awaiting admin approval.'];
    }

    public function logout(Request $r): array
    {
        AuditLog::record('logout', $r->user()->id);
        Auth::guard('web')->logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();
        return ['message' => 'You have been logged out.'];
    }

    public function changePassword(Request $r): array
    {
        $u = $r->user();
        $needsCurrent = $u->password && ! $u->must_change_password;
        $data = $r->validate([
            'current_password' => $needsCurrent ? 'required|string' : 'nullable',
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        if ($needsCurrent && ! Hash::check($data['current_password'], $u->password)) {
            $this->error('Your current password is incorrect.', 'current_password');
        }
        if ($u->password && Hash::check($data['password'], $u->password)) {
            $this->error('Choose a password different from the current one.', 'password');
        }
        $u->forceFill(['password' => $data['password'], 'must_change_password' => false])->save();
        AuditLog::record('password_change', $u->id);
        $r->session()->regenerate();

        return ['message' => 'Password updated.', 'user' => $u->toSelf()];
    }

    /* ---------- helpers ---------- */

    private function complete(Request $r, User $u, string $email, string $method): array
    {
        if ($reason = $u->blockReason()) {
            $this->error($reason);
        }
        RateLimiter::clear('login:'.$email);
        Auth::guard('web')->login($u);
        $r->session()->regenerate();
        $u->forceFill(['last_login_at' => now()])->save();
        AuditLog::record('login', $u->id, ['method' => $method], $u->id);

        return ['user' => $u->toSelf()];
    }

    private function email(string $e): string
    {
        return strtolower(trim($e));
    }

    private function throttle(string $email): void
    {
        if (RateLimiter::tooManyAttempts('login:'.$email, 5) || RateLimiter::tooManyAttempts('login-ip:'.request()->ip(), 30)) {
            throw ValidationException::withMessages(['email' => 'Too many attempts. Please try again in 15 minutes.'])->status(429);
        }
    }

    private function failed(string $email): void
    {
        RateLimiter::hit('login:'.$email, 900);
        RateLimiter::hit('login-ip:'.request()->ip(), 900);
    }

    private function error(string $msg, string $field = 'email'): never
    {
        throw ValidationException::withMessages([$field => $msg]);
    }
}
