<?php
require __DIR__ . '/inc/bootstrap.php';
if ($u = current_user()) redirect(home_for($u));

$mode  = ($_GET['m'] ?? '') === 'otp' ? 'otp' : 'pw';
$email = normalize_email((string)($_POST['email'] ?? ''));
$error = null;

if (is_post()) {
    csrf_verify();
    $action = $_POST['action'] ?? '';

    if ($action === 'password') {
        $mode = 'pw';
        $user = null;
        if (!valid_email($email)) {
            $error = 'Enter a valid email address.';
        } elseif (throttled($email)) {
            $error = 'Too many attempts. Please try again in 15 minutes.';
        } else {
            $user = find_user_by_email($email);
            if (!$user || !$user['password_hash'] || !password_verify((string)($_POST['password'] ?? ''), $user['password_hash'])) {
                note_failure($email);
                $error = $user && !$user['password_hash']
                    ? 'This account has no password yet. Use Email OTP or Google to log in.'
                    : 'Incorrect email or password.';
            } elseif ($reason = status_block_reason($user)) {
                $error = $reason;
            } else {
                clear_failures($email);
                login_user($user, 'password');
            }
        }
    } elseif ($action === 'otp_send') {
        $mode = 'otp';
        if (!valid_email($email)) {
            $error = 'Enter a valid email address.';
        } else {
            $res = find_user_by_email($email) ? otp_send($email, 'login') : 'sent'; // don't reveal whether the account exists
            if ($res === 'wait') $error = 'A code was just sent. Please wait a minute before requesting another.';
            elseif ($res === 'fail') $error = 'We could not send the email right now. Please try again shortly.';
            else {
                $_SESSION['otp_login_email'] = $email;
                flash('ok', "If an account exists for $email, we have sent a 6-digit code.");
                redirect('login.php?m=otp');
            }
        }
    } elseif ($action === 'otp_verify') {
        $mode  = 'otp';
        $email = $_SESSION['otp_login_email'] ?? '';
        $code  = preg_replace('/\D/', '', (string)($_POST['code'] ?? ''));
        if (!$email) redirect('login.php?m=otp');
        if (throttled($email)) {
            $error = 'Too many attempts. Please try again in 15 minutes.';
        } elseif (strlen($code) !== 6 || !otp_check($email, 'login', $code) || !($user = find_user_by_email($email))) {
            note_failure($email);
            $error = 'Invalid or expired code.';
        } elseif ($reason = status_block_reason($user)) {
            unset($_SESSION['otp_login_email']);
            $error = $reason;
        } else {
            unset($_SESSION['otp_login_email']);
            clear_failures($email);
            if (!$user['email_verified_at']) q('UPDATE users SET email_verified_at = ? WHERE id = ?', [now(), $user['id']]);
            login_user($user, 'otp');
        }
    } elseif ($action === 'otp_restart') {
        unset($_SESSION['otp_login_email']);
        redirect('login.php?m=otp');
    }
}

$otpEmail = $_SESSION['otp_login_email'] ?? null;
page_head('Log in', ['narrow' => true]);
?>
<div class="card auth">
  <h1>Welcome back</h1>
  <p class="sub">Log in to your GR Trading account.</p>

  <div class="tabs">
    <a class="<?= $mode === 'pw' ? 'on' : '' ?>" href="<?= url('login.php') ?>">Password</a>
    <a class="<?= $mode === 'otp' ? 'on' : '' ?>" href="<?= url('login.php?m=otp') ?>">Email OTP</a>
  </div>

  <?= alert($error) ?>

<?php if ($mode === 'pw'): ?>
  <form method="post" novalidate>
    <?= csrf_field() ?><input type="hidden" name="action" value="password">
    <div class="f"><label for="email">Email</label><input id="email" type="email" name="email" value="<?= e($email) ?>" autocomplete="email" required autofocus></div>
    <div class="f"><label for="password">Password</label><input id="password" type="password" name="password" autocomplete="current-password" required></div>
    <button class="btn btn-block" type="submit">Log in</button>
  </form>
<?php elseif (!$otpEmail): ?>
  <form method="post" novalidate>
    <?= csrf_field() ?><input type="hidden" name="action" value="otp_send">
    <div class="f"><label for="email">Email</label><input id="email" type="email" name="email" value="<?= e($email) ?>" autocomplete="email" required autofocus></div>
    <button class="btn btn-block" type="submit">Send code</button>
  </form>
<?php else: ?>
  <p class="small muted">Enter the 6-digit code sent to <b><?= e($otpEmail) ?></b>.</p>
  <form method="post" novalidate>
    <?= csrf_field() ?><input type="hidden" name="action" value="otp_verify">
    <div class="f"><input class="otp" type="text" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6" autocomplete="one-time-code" aria-label="6-digit code" required autofocus></div>
    <button class="btn btn-block" type="submit">Verify &amp; log in</button>
  </form>
  <div class="links">
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="otp_send"><input type="hidden" name="email" value="<?= e($otpEmail) ?>"><button class="linkbtn" type="submit">Resend code</button></form>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="otp_restart"><button class="linkbtn" type="submit">Use a different email</button></form>
  </div>
<?php endif; ?>

  <?= google_button('signin') ?>

  <div class="links">
    <a href="<?= url('forgot.php') ?>">Forgot password?</a>
    <span>New here? <a href="<?= url('signup.php') ?>">Sign up</a></span>
  </div>
</div>
<?php page_foot();
