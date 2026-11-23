<?php

use Illuminate\Support\Facades\Route;

// Serve the built React SPA (frontend/ -> npm run build -> public/spa) for every non-API path.
Route::get('/{any?}', function () {
    $index = public_path('spa/index.html');
    if (! is_file($index)) {
        return response('Frontend not built. Run "npm run dev" in frontend/ and open http://localhost:5173, or "npm run build" to serve it from here.', 503)
            ->header('Content-Type', 'text/plain');
    }
    return response()->file($index, ['Cache-Control' => 'no-cache']);
})->where('any', '^(?!api/|sanctum/|up$).*');
