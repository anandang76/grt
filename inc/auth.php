<?php
/* ---------- Users, roles, sessions ---------- */

const ROLE_RANK   = ['user' => 1, 'admin' => 2, 'superadmin' => 3];
const ROLE_LABELS = ['user' => 'User', 'admin' => 'Admin', 'superadmin' => 'Super Admin'];

function find_user(int $id): ?array { return q('SELECT * FROM users WHERE id = ?', [$id])->fetch() ?: null; }
function find_user_by_email(string $email): ?array { return q('SELECT * FROM users WHERE email = ?', [$email])->fetch() ?: null; }

function current_user(): ?array
{
    static $loaded = false, $user = null;
    if ($loaded) return $user;
    $loaded = true;
    if (!empty($_SESSION['uid'])) {
        $u = find_user((int)$_SESSION['uid']);
        if ($u && $u['status'] === 'active') {
            $user = $u;
        } else {
            // Deactivated or deleted while logged in: end the session.
            logout_session();
            flash('err', 'Your session has ended. Please log in again.');
        }
    }
    return $user;
}

function is_admin(?array $u): bool { return $u && in_array($u['role'], ['admin', 'superadmin'], true); }
function is_super(?array $u): bool { return $u && $u['role'] === 'superadmin'; }

/** Actor may act on target only if strictly higher rank and not themselves. */
function can_manage(array $actor, array $target): bool
{
    return (int)$actor['id'] !== (int)$target['id']
        && (ROLE_RANK[$actor['role']] ?? 0) > (ROLE_RANK[$target['role']] ?? 0);
}

function home_for(array $u): string { return is_admin($u) ? 'admin/' : 'app/'; }

function status_block_reason(array $u): ?string
{
    return match ($u['status']) {
        'active'   => null,
        'pending'  => 'Your account is awaiting admin approval. We will email you once it is approved.',
        'inactive' => 'Your account is inactive. Please contact support.',
        'rejected' => 'Your signup request was not approved. Please contact support.',
        default    => 'This account is unavailable.',
    };
}

function login_user(array $u, string $method): never
{
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    q('UPDATE users SET last_login_at = ? WHERE id = ?', [now(), $u['id']]);
    audit('login', (int)$u['id'], ['method' => $method], (int)$u['id']);
    redirect($u['must_change_password'] ? 'app/profile.php' : home_for($u));
}

function logout_session(): void
{
    $_SESSION = [];
    if (PHP_SAPI !== 'cli') session_regenerate_id(true);
}

function require_login(): array
{
    $u = current_user();
    if (!$u) redirect('login.php');
    if ($u['must_change_password'] && basename($_SERVER['SCRIPT_NAME']) !== 'profile.php') {
        flash('info', 'Please set a new password to continue.');
        redirect('app/profile.php');
    }
    return $u;
}

function require_role(string ...$roles): array
{
    $u = require_login();
    if (!in_array($u['role'], $roles, true)) {
        http_response_code(403);
        page_head('Not allowed');
        echo '<div class="card"><h1>Not allowed</h1><p class="muted">You do not have access to this page.</p><a class="btn" href="' . url(home_for($u)) . '">Go home</a></div>';
        page_foot();
        exit;
    }
    return $u;
}

function create_user(array $d): int
{
    q('INSERT INTO users (name, email, phone, password_hash, google_id, role, status, email_verified_at, terms_accepted_at, created_at)
       VALUES (?,?,?,?,?,\'user\',\'pending\',?,?,?)',
      [$d['name'], $d['email'], $d['phone'], $d['password_hash'] ?? null, $d['google_id'] ?? null,
       $d['email_verified_at'] ?? null, now(), now()]);
    $id = (int)db()->lastInsertId();
    audit('signup', $id, ['via' => !empty($d['google_id']) ? 'google' : 'form'], $id);

    send_mail($d['email'], 'We received your ' . cfg('app_name') . ' signup', mail_tpl('Thanks for signing up, ' . $d['name'],
        '<p>Your account has been created and is <b>awaiting admin approval</b>.</p><p>We will email you as soon as it is approved.</p>'));

    $admins = q("SELECT email FROM users WHERE role IN ('admin','superadmin') AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($admins as $a) {
        send_mail($a, 'New signup awaiting approval: ' . $d['name'], mail_tpl('New signup awaiting approval',
            '<p><b>' . e($d['name']) . '</b> (' . e($d['email']) . ', ' . e($d['phone']) . ') signed up.</p>'
            . '<p><a href="' . e(url('admin/user.php?id=' . $id)) . '">Review in admin panel</a></p>'));
    }
    return $id;
}

/* ---------- Brute-force throttling ---------- */

function throttled(string $email): bool
{
    $since = now(-900);
    $byEmail = (int)q('SELECT COUNT(*) FROM login_attempts WHERE k = ? AND created_at > ?', ['e:' . $email, $since])->fetchColumn();
    $byIp    = (int)q('SELECT COUNT(*) FROM login_attempts WHERE k = ? AND created_at > ?', ['ip:' . client_ip(), $since])->fetchColumn();
    return $byEmail >= 5 || $byIp >= 30;
}

function note_failure(string $email): void
{
    q('INSERT INTO login_attempts (k, created_at) VALUES (?,?), (?,?)', ['e:' . $email, now(), 'ip:' . client_ip(), now()]);
}

function clear_failures(string $email): void { q('DELETE FROM login_attempts WHERE k = ?', ['e:' . $email]); }

/* ---------- Email OTP ---------- */

function otp_hash(string $email, string $purpose, string $code): string
{
    return hash_hmac('sha256', "$email|$purpose|$code", cfg('secret'));
}

/** @return 'sent'|'wait'|'fail' */
function otp_send(string $email, string $purpose): string
{
    $last = q('SELECT created_at FROM otps WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1', [$email, $purpose])->fetchColumn();
    if ($last && strtotime($last) > time() - 60) return 'wait';

    q('DELETE FROM otps WHERE created_at < ?', [now(-86400)]);
    q('DELETE FROM login_attempts WHERE created_at < ?', [now(-86400)]);
    q('UPDATE otps SET used_at = ? WHERE email = ? AND purpose = ? AND used_at IS NULL', [now(), $email, $purpose]);

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    q('INSERT INTO otps (email, purpose, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)',
      [$email, $purpose, otp_hash($email, $purpose, $code), now(600), now()]);

    $what = $purpose === 'reset' ? 'reset your password' : 'log in';
    $ok = send_mail($email, "$code is your " . cfg('app_name') . ' code', mail_tpl('Your verification code',
        "<p>Use this code to $what:</p>"
        . '<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">' . $code . '</p>'
        . '<p style="color:#666">It expires in 10 minutes. If you did not request this, you can ignore this email.</p>'));
    return $ok ? 'sent' : 'fail';
}

function otp_check(string $email, string $purpose, string $code): bool
{
    $row = q('SELECT id, code_hash, attempts, expires_at FROM otps WHERE email = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1',
             [$email, $purpose])->fetch();
    if (!$row || strtotime($row['expires_at']) < time() || $row['attempts'] >= 5) return false;
    if (hash_equals($row['code_hash'], otp_hash($email, $purpose, $code))) {
        q('UPDATE otps SET used_at = ? WHERE id = ?', [now(), $row['id']]);
        return true;
    }
    q('UPDATE otps SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
    return false;
}

/* ---------- Google Sign-In (ID token verification) ---------- */

function google_verify(string $jwt): ?array
{
    $cid = cfg('google_client_id');
    if ($jwt === '' || !$cid) return null;
    $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($jwt));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !$res) return null;
    $c = json_decode($res, true);
    if (!is_array($c)) return null;
    $verified = ($c['email_verified'] ?? null) === true || ($c['email_verified'] ?? null) === 'true';
    if (($c['aud'] ?? '') !== $cid
        || !in_array($c['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
        || !$verified || empty($c['email']) || empty($c['sub'])
        || (int)($c['exp'] ?? 0) < time()) {
        return null;
    }
    return $c;
}
