<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Ends the session if the signed-in user was deactivated. Optionally restricts by role: `active:admin,superadmin`. */
class EnsureActive
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user || $user->status !== 'active') {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            return response()->json(['message' => 'Your session has ended. Please log in again.'], 401);
        }
        if ($roles && ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You do not have access to this.'], 403);
        }
        if ($user->must_change_password && ! $request->routeIs('auth.me', 'auth.password', 'auth.logout')) {
            return response()->json(['message' => 'Please set a new password to continue.', 'must_change_password' => true], 403);
        }
        return $next($request);
    }
}
