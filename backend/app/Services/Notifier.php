<?php

namespace App\Services;

use App\Mail\SimpleMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/** Account emails. Failures are logged and never break the request. */
class Notifier
{
    private function send(string $to, string $subject, string $title, string $html): bool
    {
        try {
            Mail::to($to)->send(new SimpleMail($subject, $title, $html));
            return true;
        } catch (\Throwable $e) {
            Log::error("Mail to $to failed: ".$e->getMessage());
            return false;
        }
    }

    private function button(string $url, string $label): string
    {
        return '<p><a href="'.e($url).'" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">'.e($label).'</a></p>';
    }

    private function frontend(string $path = ''): string
    {
        return rtrim((string) config('services.frontend_url'), '/').'/'.ltrim($path, '/');
    }

    public function signupReceived(User $u): void
    {
        $app = config('app.name');
        $this->send($u->email, "We received your $app signup", 'Thanks for signing up, '.e($u->name),
            '<p>Your account has been created and is <b>awaiting admin approval</b>.</p><p>We will email you as soon as it is approved.</p>');

        User::whereIn('role', ['admin', 'superadmin'])->where('status', 'active')->pluck('email')
            ->each(fn ($admin) => $this->send($admin, 'New signup awaiting approval: '.$u->name, 'New signup awaiting approval',
                '<p><b>'.e($u->name).'</b> ('.e($u->email).', '.e($u->phone).') signed up.</p>'
                .$this->button($this->frontend('admin/users/'.$u->id), 'Review in admin panel')));
    }

    public function approved(User $u): void
    {
        $this->send($u->email, 'Your '.config('app.name').' account is approved', 'Welcome, '.e($u->name).'!',
            '<p>Your account has been approved. You can now log in.</p>'.$this->button($this->frontend('login'), 'Log in'));
    }

    public function rejected(User $u): void
    {
        $this->send($u->email, 'Your '.config('app.name').' signup', 'Signup update',
            '<p>We are unable to approve your account at this time. Please contact support if you think this is a mistake.</p>');
    }

    public function tempPassword(User $u, string $temp): bool
    {
        return $this->send($u->email, 'Your '.config('app.name').' password was reset', 'Password reset',
            '<p>An administrator reset your password. Your temporary password is:</p>'
            .'<p style="font-size:20px;font-weight:700;font-family:monospace;margin:12px 0">'.e($temp).'</p>'
            .'<p>You will be asked to set a new password when you log in.</p>');
    }
}
