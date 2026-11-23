<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('admin', 'superadmin');

$t = find_user((int)($_GET['id'] ?? 0));
if (!$t) { flash('err', 'User not found.'); redirect('admin/users.php'); }

$canManage = can_manage($me, $t);
$approver  = $t['approved_by'] ? find_user((int)$t['approved_by']) : null;
$activity  = q('SELECT a.*, u.name actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
                WHERE a.target_id = ? OR a.actor_id = ? ORDER BY a.id DESC LIMIT 15', [$t['id'], $t['id']])->fetchAll();

$hidden = csrf_field() . '<input type="hidden" name="id" value="' . (int)$t['id'] . '">';
$action = url('admin/action.php');

page_head($t['name'], ['nav' => 'admin']);
?>
<div class="page-h">
  <div><a class="small" href="<?= url('admin/users.php') ?>">← All users</a><h1 style="margin-top:4px"><?= e($t['name']) ?></h1></div>
  <div><?= badge($t['role'], ROLE_LABELS[$t['role']] ?? $t['role']) ?> <?= badge($t['status']) ?></div>
</div>

<div class="two">
  <div class="card">
    <h2>Details</h2>
    <dl class="kv">
      <dt>Email</dt><dd><?= e($t['email']) ?><?= $t['email_verified_at'] ? ' <span class="badge b-active">verified</span>' : '' ?></dd>
      <dt>Mobile</dt><dd><?= e($t['phone'] ?: '—') ?></dd>
      <dt>Login methods</dt><dd><?= implode(', ', array_filter([$t['password_hash'] ? 'Password' : null, 'Email OTP', $t['google_id'] ? 'Google' : null])) ?></dd>
      <dt>Signed up</dt><dd><?= e(fmt_dt($t['created_at'])) ?></dd>
      <dt>Terms accepted</dt><dd><?= e(fmt_dt($t['terms_accepted_at'])) ?></dd>
      <dt>Approved</dt><dd><?= $t['approved_at'] ? e(fmt_dt($t['approved_at'])) . ($approver ? ' by ' . e($approver['name']) : '') : '—' ?></dd>
      <dt>Last login</dt><dd><?= e(fmt_dt($t['last_login_at'])) ?></dd>
    </dl>
  </div>

  <div class="card actions-list">
    <h2>Actions</h2>
<?php if (!$canManage): ?>
    <p class="muted small" style="margin:0"><?= (int)$t['id'] === (int)$me['id'] ? 'You cannot change your own account here. Use Profile instead.' : 'You do not have permission to manage this account.' ?></p>
<?php else: ?>
  <?php if ($t['status'] === 'pending'): ?>
    <form method="post" action="<?= $action ?>"><?= $hidden ?><span class="grow">Approve this signup so the user can log in.</span>
      <button class="btn btn-sm btn-ok" name="do" value="approve">Approve</button>
      <button class="btn btn-sm btn-line" name="do" value="reject" onclick="return confirm('Reject this signup?')">Reject</button></form>
  <?php elseif ($t['status'] === 'active'): ?>
    <form method="post" action="<?= $action ?>" onsubmit="return confirm('Deactivate this user? They will be logged out immediately.')"><?= $hidden ?><span class="grow">Block this user from logging in.</span>
      <button class="btn btn-sm btn-err" name="do" value="deactivate">Deactivate</button></form>
  <?php else: ?>
    <form method="post" action="<?= $action ?>"><?= $hidden ?><span class="grow">Allow this user to log in again.</span>
      <button class="btn btn-sm btn-ok" name="do" value="activate">Activate</button></form>
  <?php endif; ?>

  <?php if (is_super($me)): ?>
    <form method="post" action="<?= $action ?>" onsubmit="return confirm('Generate a temporary password and email it to this user?')"><?= $hidden ?>
      <span class="grow">Reset password: email a temporary password. The user must change it at next login.</span>
      <button class="btn btn-sm btn-line" name="do" value="reset_password">Reset password</button></form>
    <form method="post" action="<?= $action ?>"><?= $hidden ?><input type="hidden" name="do" value="set_role">
      <label class="grow" for="role" style="margin:0">Role</label>
      <select id="role" name="role" style="flex:1 1 140px;max-width:180px;height:34px">
        <?php foreach (['user', 'admin'] as $r): ?><option value="<?= $r ?>" <?= $t['role'] === $r ? 'selected' : '' ?>><?= ROLE_LABELS[$r] ?></option><?php endforeach; ?>
      </select>
      <button class="btn btn-sm btn-line" type="submit">Save role</button></form>
  <?php endif; ?>
<?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:16px">
  <h2>Recent activity</h2>
<?php if (!$activity): ?>
  <p class="muted small" style="margin:0">No activity yet.</p>
<?php else: ?>
  <ul class="log">
  <?php foreach ($activity as $a): ?>
    <li><b><?= e(str_replace('_', ' ', $a['action'])) ?></b>
      <?= $a['actor_name'] && (int)$a['actor_id'] !== (int)$t['id'] ? ' by ' . e($a['actor_name']) : '' ?>
      <?php $m = $a['meta'] ? json_decode($a['meta'], true) : []; if ($m): ?><span class="muted"> · <?= e(implode(', ', array_map(fn($k, $v) => "$k: $v", array_keys($m), $m))) ?></span><?php endif; ?>
      <div class="muted"><?= e(fmt_dt($a['created_at'])) ?> · <?= e($a['ip']) ?></div></li>
  <?php endforeach; ?>
  </ul>
<?php endif; ?>
</div>
<?php page_foot();
