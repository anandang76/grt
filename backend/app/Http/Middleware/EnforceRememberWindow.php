<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Remember me for today" cutoff. The browser deletes the remember-me cookie at midnight,
 * but a copied cookie could be replayed, so the server rejects it after users.remember_until.
 */
class EnforceRememberWindow
{
    public function handle(Request $request, Closure $next): Response
    {
        // Needs a session (and thus the stateful-frontend middleware) to be meaningful.
        // If one isn't set up for this request, there's nothing to enforce — don't touch it.
        if (! $request->hasSession()) {
            return $next($request);
        }

        $guard = Auth::guard('web');
        $user = $guard->user(); // resolves the remember-me cookie when there is no session

        if ($user && $guard->viaRemember() && (! $user->remember_until || now()->gt($user->remember_until))) {
            $guard->logout(); // also rotates the remember token and expires the cookie
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return $next($request);
    }
}
