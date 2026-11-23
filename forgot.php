<?php
require __DIR__ . '/inc/bootstrap.php';
if ($u = current_user()) redirect(home_for($u));

$error = null;
$email = normalize_email(input('email'));

if (is_post()) {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'send') {
        if (!valid_email($email)) {
            $error = 'Enter a valid email address.';
        } else {
            $res = find_user_by_email($email) ? otp_send($email, 'reset') : 'sent';
            if ($res === 'wait') $error = 'A code was just sent. Please wait a minute before requesting another.';
            elseif ($res === 'fail') $error = 'We could not send the email right now. Please try again shortly.';
            else {
                $_SESSION['reset_email'] = $email;
                flash('ok', "If an account exists for $email, we have sent a 6-digit code.");
                redirect('forgot.php');
            }
        }
    } elseif ($action === 'reset') {
        $email = $_SESSION['reset_email'] ?? '';
        $code  = preg_replace('/\D/', '', (string)($_POST['code'] ?? ''));
        $pw    = (string)($_POST['password'] ?? '');
        if (!$email) redirect('forgot.php');
        if (throttled($email)) {
            $error = 'Too many attempts. Please try again in 15 minutes.';
        } elseif ($p = password_problem($pw)) {
            $error = $p;
        } elseif ($pw !== (string)($_POST['password2'] ?? '')) {
            $error = 'Passwords do not match.';
        } elseif (strlen($code) !== 6 || !otp_check($email, 'reset', $code) || !($user = find_user_by_email($email))) {
            note_failure($email);
            $error = 'Invalid or expired code.';
        } else {
            q('UPDATE users SET password_hash = ?, must_change_password = 0, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?',
              [password_hash($pw, PASSWORD_DEFAULT), now(), now(), $user['id']]);
            audit('password_reset_self', (int)$user['id'], [], (int)$user['id']);
            clear_failures($email);
            unset($_SESSION['reset_email']);
            flash('ok', 'Your password has been updated. Please log in.');
            redirect('login.php');
        }
    } elseif ($action === 'restart') {
        unset($_SESSION['reset_email']);
        redirect('forgot.php');
    }
}

$resetEmail = $_SESSION['reset_email'] ?? null;
page_head('Forgot password', ['narrow' => true]);
?>
<div class="card auth">
  <h1>Reset password</h1>
<?php if (!$resetEmail): ?>
  <p class="sub">Enter your email and we will send you a 6-digit code.</p>
  <?= alert($error) ?>
  <form method="post" novalidate>
    <?= csrf_field() ?><input type="hidden" name="action" value="send">
    <div class="f"><label for="email">Email</label><input id="email" type="email" name="email" value="<?= e($email) ?>" autocomplete="email" required autofocus></div>
    <button class="btn btn-block" type="submit">Send code</button>
  </form>
<?php else: ?>
  <p class="sub">Enter the code sent to <b><?= e($resetEmail) ?></b> and choose a new password.</p>
  <?= alert($error) ?>
  <form method="post" novalidate>
    <?= csrf_field() ?><input type="hidden" name="action" value="reset">
    <div class="f"><label for="code">6-digit code</label><input id="code" class="otp" type="text" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required autofocus></div>
    <div class="f"><label for="password">New password</label><input id="password" type="password" name="password" autocomplete="new-password" required><div class="hint">At least 8 characters, with letters and numbers.</div></div>
    <div class="f"><label for="password2">Confirm new password</label><input id="password2" type="password" name="password2" autocomplete="new-password" required></div>
    <button class="btn btn-block" type="submit">Update password</button>
  </form>
  <div class="links">
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="send"><input type="hidden" name="email" value="<?= e($resetEmail) ?>"><button class="linkbtn" type="submit">Resend code</button></form>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="restart"><button class="linkbtn" type="submit">Use a different email</button></form>
  </div>
<?php endif; ?>
  <div class="links"><a href="<?= url('login.php') ?>">← Back to log in</a></div>
</div>
<?php page_foot();
