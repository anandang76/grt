<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_login();
$error = null;
$needsCurrent = $me['password_hash'] && !$me['must_change_password'];

if (is_post()) {
    csrf_verify();
    $pw = (string)($_POST['password'] ?? '');
    if ($needsCurrent && !password_verify((string)($_POST['current'] ?? ''), $me['password_hash'])) {
        $error = 'Your current password is incorrect.';
    } elseif ($p = password_problem($pw)) {
        $error = $p;
    } elseif ($pw !== (string)($_POST['password2'] ?? '')) {
        $error = 'Passwords do not match.';
    } elseif ($me['password_hash'] && password_verify($pw, $me['password_hash'])) {
        $error = 'Choose a password different from the current one.';
    } else {
        q('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
          [password_hash($pw, PASSWORD_DEFAULT), now(), $me['id']]);
        audit('password_change', (int)$me['id']);
        session_regenerate_id(true);
        flash('ok', 'Password updated.');
        redirect(home_for($me));
    }
}

page_head('Profile', ['narrow' => true, 'nav' => 'app']);
?>
<div class="card stack">
  <div>
    <h1><?= $me['must_change_password'] ? 'Set a new password' : 'Profile' ?></h1>
    <p class="sub" style="margin:0"><?= e($me['name']) ?> · <?= e($me['email']) ?></p>
  </div>
  <?= alert($error) ?>
  <form method="post" novalidate>
    <?= csrf_field() ?>
    <h2><?= $me['password_hash'] ? 'Change password' : 'Set a password' ?></h2>
    <?php if (!$me['password_hash']): ?><p class="small muted">You signed up with Google or OTP. Setting a password lets you log in with email and password too.</p><?php endif; ?>
    <?php if ($needsCurrent): ?>
    <div class="f"><label for="current">Current password</label><input id="current" type="password" name="current" autocomplete="current-password" required></div>
    <?php endif; ?>
    <div class="f"><label for="password">New password</label><input id="password" type="password" name="password" autocomplete="new-password" required><div class="hint">At least 8 characters, with letters and numbers.</div></div>
    <div class="f"><label for="password2">Confirm new password</label><input id="password2" type="password" name="password2" autocomplete="new-password" required></div>
    <button class="btn btn-block" type="submit">Save password</button>
  </form>
</div>
<?php page_foot();
