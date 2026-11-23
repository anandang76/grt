<?php
/* CLI installer: creates the database + tables and a Super Admin.
   Usage: php install.php
   Non-interactive: php install.php --email=a@b.com --name="Your Name" --phone=9876543210 --password=Secret123 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/inc/bootstrap.php';

$opt = getopt('', ['email::', 'name::', 'phone::', 'password::']);
$ask = function (string $label, string $key, bool $secret = false) use ($opt): string {
    if (!empty($opt[$key])) return (string)$opt[$key];
    echo $label . ': ';
    if ($secret && DIRECTORY_SEPARATOR === '/') system('stty -echo');
    $v = trim((string)fgets(STDIN));
    if ($secret && DIRECTORY_SEPARATOR === '/') { system('stty echo'); echo "\n"; }
    return $v;
};

// 1. Create database
$c = cfg('db');
$dsn = !empty($c['socket']) && file_exists($c['socket'])
    ? "mysql:unix_socket={$c['socket']};charset=utf8mb4"
    : "mysql:host={$c['host']};port={$c['port']};charset=utf8mb4";
$root = new PDO($dsn, $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$root->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $c['name']) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
echo "✓ Database `{$c['name']}` ready\n";

// 2. Tables
$sql = preg_replace('/^--.*$/m', '', file_get_contents(__DIR__ . '/install.sql'));
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) db()->exec($stmt);
echo "✓ Tables ready\n";
@mkdir(__DIR__ . '/storage', 0775, true);

// 3. Super Admin
$existing = q("SELECT email FROM users WHERE role = 'superadmin'")->fetchAll(PDO::FETCH_COLUMN);
if ($existing && empty($opt['email'])) {
    echo '• Super Admin already exists: ' . implode(', ', $existing) . "\n";
    exit(0);
}

echo "\nCreate a Super Admin account\n";
while (!valid_email($email = normalize_email($ask('Email', 'email')))) { echo "  invalid email\n"; unset($opt['email']); }
$name = $ask('Full name', 'name') ?: 'Super Admin';
$phone = normalize_phone($ask('Mobile (10 digits, optional)', 'phone'));
do {
    $pw = $ask('Password (8+ chars, letters and numbers)', 'password', true);
    $prob = password_problem($pw);
    if ($prob) { echo "  $prob\n"; unset($opt['password']); }
} while ($prob);

$hash = password_hash($pw, PASSWORD_DEFAULT);
if ($u = find_user_by_email($email)) {
    q("UPDATE users SET role = 'superadmin', status = 'active', password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", [$hash, now(), $u['id']]);
    echo "✓ Existing user $email promoted to Super Admin\n";
} else {
    q("INSERT INTO users (name, email, phone, password_hash, role, status, email_verified_at, terms_accepted_at, approved_at, created_at)
       VALUES (?,?,?,?, 'superadmin', 'active', ?, ?, ?, ?)", [$name, $email, $phone, $hash, now(), now(), now(), now()]);
    echo "✓ Super Admin $email created\n";
}
echo "\nOpen " . url('login.php') . "\n";
