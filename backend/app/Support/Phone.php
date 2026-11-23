<?php

namespace App\Support;

class Phone
{
    /** Returns a 10-digit Indian mobile number, or null if invalid. Accepts +91 / 0 prefixes, spaces and dashes. */
    public static function normalize(?string $s): ?string
    {
        $d = preg_replace('/\D/', '', (string) $s);
        if (strlen($d) === 12 && str_starts_with($d, '91')) {
            $d = substr($d, 2);
        }
        if (strlen($d) === 11 && $d[0] === '0') {
            $d = substr($d, 1);
        }
        return preg_match('/^[6-9]\d{9}$/', $d) ? $d : null;
    }
}
