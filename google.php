<?php
require __DIR__ . '/inc/bootstrap.php';
if (!is_post()) redirect('login.php');
csrf_verify();

$mode   = ($_POST['mode'] ?? '') === 'signup' ? 'signup' : 'signin';
$back   = $mode === 'signup' ? 'signup.php' : 'login.php';
$claims = google_verify((string)($_POST['credential'] ?? ''));
if (!$claims) {
    flash('err', 'Google sign-in failed. Please try again.');
    redirect($back);
}

$email = normalize_email($claims['email']);
$user  = find_user_by_email($email);

if ($user) {
    if ($user['google_id'] && $user['google_id'] !== $claims['sub']) {
        flash('err', 'This email is linked to a different Google account.');
        redirect('login.php');
    }
    if (!$user['google_id']) {
        q('UPDATE users SET google_id = ?, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?',
          [$claims['sub'], now(), now(), $user['id']]);
    }
    if ($reason = status_block_reason($user)) {
        flash($user['status'] === 'pending' ? 'info' : 'err', $reason);
        redirect('login.php');
    }
    login_user($user, 'google');
}

if ($mode !== 'signup') {
    flash('info', "No account found for $email. Please sign up first.");
    redirect('signup.php');
}
if (($_POST['terms'] ?? '') !== '1') {
    flash('err', 'Please accept the Terms & Conditions to sign up.');
    redirect('signup.php');
}
$phone = normalize_phone((string)($_POST['phone'] ?? ''));
if (!$phone) {
    flash('err', 'Enter a valid 10-digit mobile number, then continue with Google.');
    redirect('signup.php');
}

$name = trim((string)($claims['name'] ?? '')) ?: strstr($email, '@', true);
create_user([
    'name' => mb_substr($name, 0, 100), 'email' => $email, 'phone' => $phone,
    'google_id' => $claims['sub'], 'email_verified_at' => now(),
]);
redirect('signup.php?done=1');
