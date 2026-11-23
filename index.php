<?php
require __DIR__ . '/inc/bootstrap.php';
$u = current_user();
page_head('Fast, minimal trading terminal');

$icon = fn(string $path) => '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . $path . '</svg></div>';
?>
<section class="hero">
  <div>
    <span class="pill">BY GR FINTECH</span>
    <h1>Trade with <em>speed</em> and clarity.</h1>
    <p>GR Trading is a fast, minimal trading terminal for Indian markets. Stocks, F&amp;O and more, built to load instantly on any phone or desktop.</p>
    <div class="cta">
<?php if ($u): ?>
      <a class="btn" href="<?= url(home_for($u)) ?>">Open <?= is_admin($u) ? 'admin panel' : 'terminal' ?> →</a>
<?php else: ?>
      <a class="btn" href="<?= url('signup.php') ?>">Open an account</a>
      <a class="btn btn-line" href="<?= url('login.php') ?>">Log in</a>
<?php endif; ?>
    </div>
  </div>
  <div class="card art" aria-hidden="true">
    <div class="art-h"><b>Market overview</b><span class="small muted">Illustration</span></div>
    <svg viewBox="0 0 320 150" preserveAspectRatio="none">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".28"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
      <path d="M0 120 L25 112 L50 116 L75 96 L100 100 L125 82 L150 88 L175 64 L200 70 L225 50 L250 58 L275 36 L300 42 L320 24 L320 150 L0 150Z" fill="url(#g)"/>
      <path d="M0 120 L25 112 L50 116 L75 96 L100 100 L125 82 L150 88 L175 64 L200 70 L225 50 L250 58 L275 36 L300 42 L320 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>
  </div>
</section>

<section>
  <div class="grid">
    <div class="card feat"><?= $icon('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>') ?><h3>Built for speed</h3><p>Lightweight pages with no bloat. Loads fast even on slow mobile networks.</p></div>
    <div class="card feat"><?= $icon('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>') ?><h3>Mobile first</h3><p>Designed for your phone first, and it scales up neatly to a desktop terminal.</p></div>
    <div class="card feat"><?= $icon('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>') ?><h3>Secure access</h3><p>Log in with a password, a one-time code sent to your email, or your Google account.</p></div>
    <div class="card feat"><?= $icon('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>') ?><h3>Broker-grade backend</h3><p>Orders and market data go through established Indian broker platforms.</p></div>
  </div>
</section>

<?php if (!$u): ?>
<section class="card band">
  <div><h2 style="margin:0">Ready to start?</h2><p class="muted" style="margin:4px 0 0">Sign up in a minute. An admin approves new accounts before first login.</p></div>
  <a class="btn" href="<?= url('signup.php') ?>">Create account</a>
</section>
<?php endif; ?>
<?php page_foot();
