<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_login();
$first = explode(' ', trim($me['name']))[0];

$tiles = [
    ['Watchlist', 'Track your favourite stocks', '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'],
    ['Orders', 'Place and track orders', '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'],
    ['Positions', 'Open positions and P&amp;L', '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'],
    ['Funds', 'Margins and balances', '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/>'],
];

page_head('Home', ['nav' => 'app']);
?>
<div class="page-h">
  <div><h1>Hi, <?= e($first) ?> 👋</h1><p class="muted" style="margin:0">Welcome to your GR Trading terminal.</p></div>
  <?php if (is_admin($me)): ?><a class="btn btn-line btn-sm" href="<?= url('admin/') ?>">Admin panel →</a><?php endif; ?>
</div>

<div class="tiles">
<?php foreach ($tiles as [$t, $d, $svg]): ?>
  <div class="card tile">
    <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><?= $svg ?></svg></div>
    <h3><?= $t ?> <span class="soon">SOON</span></h3><p><?= $d ?></p>
  </div>
<?php endforeach; ?>
</div>

<div class="card" style="margin-top:16px">
  <h2>Your account</h2>
  <dl class="kv">
    <dt>Name</dt><dd><?= e($me['name']) ?></dd>
    <dt>Email</dt><dd><?= e($me['email']) ?></dd>
    <dt>Mobile</dt><dd><?= e($me['phone'] ?: '—') ?></dd>
    <dt>Role</dt><dd><?= badge($me['role'], ROLE_LABELS[$me['role']]) ?></dd>
  </dl>
  <p style="margin:14px 0 0"><a href="<?= url('app/profile.php') ?>">Change password →</a></p>
</div>
<?php page_foot();
