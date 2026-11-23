<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('admin', 'superadmin');

$counts = ['total' => 0, 'pending' => 0, 'active' => 0, 'inactive' => 0];
foreach (q('SELECT status, COUNT(*) c FROM users GROUP BY status')->fetchAll() as $r) {
    $counts['total'] += $r['c'];
    if ($r['status'] === 'rejected') $counts['inactive'] += $r['c'];
    else $counts[$r['status']] = (int)$r['c'];
}
$pending = q("SELECT id, name, email, phone, google_id, created_at FROM users WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50")->fetchAll();

page_head('Admin', ['nav' => 'admin']);
?>
<div class="page-h"><div><h1>Admin</h1><p class="muted" style="margin:0">Hello, <?= e($me['name']) ?> · <?= badge($me['role'], ROLE_LABELS[$me['role']]) ?></p></div></div>
<?php admin_tabs($me, 'index'); ?>

<div class="stats">
  <a class="card stat" href="<?= url('admin/users.php') ?>"><b><?= $counts['total'] ?></b><span>Total users</span></a>
  <a class="card stat" href="<?= url('admin/users.php?status=pending') ?>"><b style="color:var(--warn)"><?= $counts['pending'] ?></b><span>Pending approval</span></a>
  <a class="card stat" href="<?= url('admin/users.php?status=active') ?>"><b style="color:var(--ok)"><?= $counts['active'] ?></b><span>Active</span></a>
  <a class="card stat" href="<?= url('admin/users.php?status=inactive') ?>"><b style="color:var(--err)"><?= $counts['inactive'] ?></b><span>Inactive / rejected</span></a>
</div>

<div class="card tcard">
  <div class="tcard-h"><h2>Pending approvals</h2><span class="badge b-pending"><?= count($pending) ?></span></div>
<?php if (!$pending): ?>
  <div class="empty">No signups waiting for approval.</div>
<?php else: ?>
  <table class="rt">
    <thead><tr><th>User</th><th>Mobile</th><th>Signed up</th><th></th></tr></thead>
    <tbody>
<?php foreach ($pending as $p): ?>
      <tr>
        <td class="who"><a href="<?= url('admin/user.php?id=' . $p['id']) ?>"><b><?= e($p['name']) ?></b></a><span><?= e($p['email']) ?><?= $p['google_id'] ? ' · Google' : '' ?></span></td>
        <td data-l="Mobile"><?= e($p['phone'] ?: '—') ?></td>
        <td data-l="Signed up"><?= e(fmt_dt($p['created_at'])) ?></td>
        <td class="acts"><div class="row-actions">
          <form method="post" action="<?= url('admin/action.php') ?>"><?= csrf_field() ?><input type="hidden" name="id" value="<?= $p['id'] ?>"><input type="hidden" name="back" value="admin/"><button class="btn btn-sm btn-ok" name="do" value="approve">Approve</button></form>
          <form method="post" action="<?= url('admin/action.php') ?>" onsubmit="return confirm('Reject this signup?')"><?= csrf_field() ?><input type="hidden" name="id" value="<?= $p['id'] ?>"><input type="hidden" name="back" value="admin/"><button class="btn btn-sm btn-line" name="do" value="reject">Reject</button></form>
        </div></td>
      </tr>
<?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
</div>
<?php page_foot();
