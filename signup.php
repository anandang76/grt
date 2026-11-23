<?php
require __DIR__ . '/inc/bootstrap.php';
if ($u = current_user()) redirect(home_for($u));

$v = ['name' => input('name'), 'email' => normalize_email(input('email')), 'phone' => input('phone')];
$errors = [];

if (is_post()) {
    csrf_verify();
    $pw = (string)($_POST['password'] ?? '');
    $phone = normalize_phone($v['phone']);

    if (mb_strlen($v['name']) < 2 || mb_strlen($v['name']) > 100) $errors['name'] = 'Enter your full name.';
    if (!valid_email($v['email'])) $errors['email'] = 'Enter a valid email address.';
    elseif (find_user_by_email($v['email'])) $errors['email'] = 'An account with this email already exists. Please log in.';
    if (!$phone) $errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';
    if ($p = password_problem($pw)) $errors['password'] = $p;
    elseif ($pw !== (string)($_POST['password2'] ?? '')) $errors['password2'] = 'Passwords do not match.';
    if (empty($_POST['terms'])) $errors['terms'] = 'You must accept the Terms & Conditions.';

    if (!$errors) {
        create_user([
            'name' => $v['name'], 'email' => $v['email'], 'phone' => $phone,
            'password_hash' => password_hash($pw, PASSWORD_DEFAULT),
        ]);
        redirect('signup.php?done=1');
    }
}

$err = fn(string $k) => isset($errors[$k]) ? '<div class="hint" style="color:var(--err)">' . e($errors[$k]) . '</div>' : '';
page_head('Sign up', ['narrow' => true]);

if (isset($_GET['done'])): ?>
<div class="card auth center">
  <div class="big-ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
  <h1>Signup received</h1>
  <p class="sub">Your account is <b>awaiting admin approval</b>. We will email you as soon as it is approved, and then you can log in.</p>
  <a class="btn btn-line" href="<?= url('') ?>">Back to home</a>
</div>
<?php else: ?>
<div class="card auth">
  <h1>Create your account</h1>
  <p class="sub">An admin approves new accounts before first login.</p>
  <form method="post" novalidate>
    <?= csrf_field() ?>
    <div class="f"><label for="name">Full name</label><input id="name" type="text" name="name" value="<?= e($v['name']) ?>" autocomplete="name" required autofocus><?= $err('name') ?></div>
    <div class="f"><label for="email">Email</label><input id="email" type="email" name="email" value="<?= e($v['email']) ?>" autocomplete="email" required><?= $err('email') ?></div>
    <div class="f"><label for="phone">Mobile number</label><input id="phone" type="tel" name="phone" value="<?= e($v['phone']) ?>" inputmode="tel" autocomplete="tel-national" placeholder="10-digit mobile" required><?= $err('phone') ?></div>
    <div class="f"><label for="password">Password</label><input id="password" type="password" name="password" autocomplete="new-password" required><div class="hint">At least 8 characters, with letters and numbers.</div><?= $err('password') ?></div>
    <div class="f"><label for="password2">Confirm password</label><input id="password2" type="password" name="password2" autocomplete="new-password" required><?= $err('password2') ?></div>
    <div class="f"><label class="check"><input id="terms" type="checkbox" name="terms" value="1" <?= !empty($_POST['terms']) ? 'checked' : '' ?>> <span>I accept the <a href="<?= url('terms.php') ?>" target="_blank">Terms &amp; Conditions</a> and Privacy Policy.</span></label><?= $err('terms') ?></div>
    <button class="btn btn-block" type="submit">Sign up</button>
  </form>

  <?php if (cfg('google_client_id')): ?>
  <?= google_button('signup') ?>
  <p class="hint center">For Google signup, enter your mobile number and accept the terms above first.</p>
  <?php endif; ?>

  <div class="links"><span>Already have an account? <a href="<?= url('login.php') ?>">Log in</a></span></div>
</div>
<?php endif;
page_foot();
