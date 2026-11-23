<?php
define('ROOT', dirname(__DIR__));

if (!is_file(ROOT . '/config.php')) {
    http_response_code(500);
    exit('Missing config.php. Copy config.sample.php to config.php and edit it.');
}
$GLOBALS['CONFIG'] = require ROOT . '/config.php';

function cfg(string $key, $default = null) { return $GLOBALS['CONFIG'][$key] ?? $default; }

date_default_timezone_set(cfg('timezone', 'Asia/Kolkata'));
error_reporting(E_ALL);
ini_set('display_errors', cfg('debug') ? '1' : '0');

if (PHP_SAPI !== 'cli') {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    session_name('grt_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => parse_url(cfg('base_url'), PHP_URL_PATH) ?: '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

require __DIR__ . '/mail.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/layout.php';

/* ---------- Core helpers ---------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = cfg('db');
    $dsn = !empty($c['socket']) && file_exists($c['socket'])
        ? "mysql:unix_socket={$c['socket']};dbname={$c['name']};charset=utf8mb4"
        : "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function url(string $p = ''): string { return rtrim(cfg('base_url'), '/') . '/' . ltrim($p, '/'); }
function now(int $offset = 0): string { return date('Y-m-d H:i:s', time() + $offset); }
function is_post(): bool { return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'; }
function input(string $k): string { return trim((string)($_POST[$k] ?? '')); }
function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? 'cli'; }

function redirect(string $p): never
{
    header('Location: ' . (preg_match('#^https?://#', $p) ? $p : url($p)));
    exit;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="_csrf" value="' . csrf_token() . '">'; }
function csrf_verify(): void
{
    if (!hash_equals(csrf_token(), (string)($_POST['_csrf'] ?? ''))) {
        http_response_code(419);
        exit('Your session expired. Please go back, refresh the page and try again.');
    }
}

function flash(string $type, string $msg): void { $_SESSION['flash'][] = [$type, $msg]; }
function take_flashes(): array { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }

function normalize_email(string $s): string { return strtolower(trim($s)); }
function valid_email(string $s): bool { return strlen($s) <= 190 && filter_var($s, FILTER_VALIDATE_EMAIL) !== false; }

/** Returns a 10-digit Indian mobile number, or null if invalid. */
function normalize_phone(string $s): ?string
{
    $d = preg_replace('/\D/', '', $s);
    if (strlen($d) === 12 && str_starts_with($d, '91')) $d = substr($d, 2);
    if (strlen($d) === 11 && $d[0] === '0') $d = substr($d, 1);
    return preg_match('/^[6-9]\d{9}$/', $d) ? $d : null;
}

function password_problem(string $p): ?string
{
    if (strlen($p) < 8) return 'Password must be at least 8 characters.';
    if (!preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) return 'Password must contain letters and numbers.';
    return null;
}

function audit(string $action, ?int $target = null, array $meta = [], ?int $actor = null): void
{
    $actor ??= $_SESSION['uid'] ?? null;
    q('INSERT INTO audit_log (actor_id, action, target_id, meta, ip, created_at) VALUES (?,?,?,?,?,?)',
      [$actor, $action, $target, $meta ? json_encode($meta) : null, client_ip(), now()]);
}

function fmt_dt(?string $dt): string { return $dt ? date('d M Y, H:i', strtotime($dt)) : '—'; }
