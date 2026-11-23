<?php
/* ---------- Page chrome ---------- */

function page_head(string $title, array $o = []): void
{
    $u = current_user();
    $here = $o['nav'] ?? '';
    $initials = $u ? strtoupper(implode('', array_map(fn($w) => $w[0] ?? '', array_slice(preg_split('/\s+/', trim($u['name'])), 0, 2)))) : '';
    ?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2563eb">
<meta name="description" content="GR Trading – a fast, minimal trading terminal by GR FinTech.">
<title><?= e($title) ?> · <?= e(cfg('app_name')) ?></title>
<link rel="icon" href="<?= url('assets/favicon.svg') ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= url('assets/app.css') ?>?v=1">
</head>
<body>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="<?= url($u ? home_for($u) : '') ?>"><span class="logo">GR</span><span>Trading</span></a>
    <nav class="nav">
<?php if ($u): ?>
      <?php if (is_admin($u)): ?><a class="<?= $here === 'admin' ? 'on' : '' ?>" href="<?= url('admin/') ?>">Admin</a><?php endif; ?>
      <a class="<?= $here === 'app' ? 'on' : '' ?>" href="<?= url('app/') ?>">Terminal</a>
      <details class="menu">
        <summary aria-label="Account menu"><?= e($initials ?: '?') ?></summary>
        <div class="menu-pop">
          <div class="who"><b><?= e($u['name']) ?></b><div class="muted small"><?= e($u['email']) ?></div><span class="badge b-<?= e($u['role']) ?>"><?= e(ROLE_LABELS[$u['role']] ?? $u['role']) ?></span></div>
          <a href="<?= url('app/profile.php') ?>">Profile &amp; password</a>
          <form method="post" action="<?= url('logout.php') ?>"><?= csrf_field() ?><button type="submit">Log out</button></form>
        </div>
      </details>
<?php else: ?>
      <a href="<?= url('login.php') ?>">Log in</a>
      <a class="btn btn-sm" href="<?= url('signup.php') ?>">Sign up</a>
<?php endif; ?>
    </nav>
  </div>
</header>
<main class="wrap<?= !empty($o['narrow']) ? ' narrow' : '' ?>">
<?php foreach (take_flashes() as [$type, $msg]): ?>
  <div class="alert alert-<?= e($type) ?>" role="status"><?= e($msg) ?></div>
<?php endforeach;
}

function page_foot(): void
{
    ?>
</main>
<footer>
  <div class="wrap">
    <div class="foot">
      <span>© <?= date('Y') ?> <?= e(cfg('app_name')) ?> · <a href="<?= url('terms.php') ?>">Terms</a></span>
      <span>Maintained by <a href="https://grfintech.in" target="_blank" rel="noopener"><b>GRFinTech</b></a></span>
    </div>
    <p class="disc">Investments in the securities market are subject to market risks. Read all related documents carefully before investing.</p>
  </div>
</footer>
</body>
</html>
<?php
}

function alert(?string $msg, string $type = 'err'): string
{
    return $msg ? '<div class="alert alert-' . e($type) . '" role="alert">' . e($msg) . '</div>' : '';
}

function badge(string $value, ?string $label = null): string
{
    return '<span class="badge b-' . e($value) . '">' . e($label ?? ucfirst($value)) . '</span>';
}

function admin_tabs(array $u, string $active): void
{
    $tabs = ['index' => ['Overview', 'admin/'], 'users' => ['Users', 'admin/users.php']];
    if (is_super($u)) {
        $tabs['roles'] = ['Roles', 'admin/roles.php'];
        $tabs['audit'] = ['Activity', 'admin/audit.php'];
    }
    echo '<nav class="subnav">';
    foreach ($tabs as $k => [$label, $href]) {
        echo '<a class="' . ($k === $active ? 'on' : '') . '" href="' . url($href) . '">' . e($label) . '</a>';
    }
    echo '</nav>';
}

/** Google Identity Services button. $mode: 'signin' | 'signup'. Renders nothing if no client id configured. */
function google_button(string $mode): string
{
    $cid = cfg('google_client_id');
    if (!$cid) return '';
    $text = $mode === 'signup' ? 'signup_with' : 'signin_with';
    return '<div class="or"><span>or</span></div>'
        . '<form id="gform" method="post" action="' . url('google.php') . '">' . csrf_field()
        . '<input type="hidden" name="mode" value="' . $mode . '">'
        . '<input type="hidden" name="credential" id="gcred"><input type="hidden" name="terms" id="gterms" value="0"><input type="hidden" name="phone" id="gphone"></form>'
        . '<div id="g_id_onload" data-client_id="' . e($cid) . '" data-callback="onGoogle" data-auto_prompt="false"></div>'
        . '<div class="gbtn"><div class="g_id_signin" data-type="standard" data-shape="pill" data-size="large" data-text="' . $text . '" data-width="300"></div></div>'
        . '<script>function onGoogle(r){var f=document.getElementById("gform"),t=document.getElementById("terms"),p=document.getElementById("phone");'
        . 'if(f.elements.mode.value==="signup"){if(!p||!p.value.trim()){alert("Please enter your mobile number first.");p&&p.focus();return;}'
        . 'if(!t||!t.checked){alert("Please accept the Terms & Conditions first.");return;}'
        . 'document.getElementById("gterms").value="1";document.getElementById("gphone").value=p.value;}'
        . 'document.getElementById("gcred").value=r.credential;f.submit();}</script>'
        . '<script src="https://accounts.google.com/gsi/client" async defer></script>';
}
