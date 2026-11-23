<?php

use App\Models\User;
use App\Support\Phone;
use Illuminate\Support\Facades\Artisan;

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
