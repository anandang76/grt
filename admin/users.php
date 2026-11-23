<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('admin', 'superadmin');

$qText  = trim((string)($_GET['q'] ?? ''));
$status = $_GET['status'] ?? '';
$role   = $_GET['role'] ?? '';
$page   = max(1, (int)($_GET['p'] ?? 1));
$per    = 25;

$where = [];
$args  = [];
if ($qText !== '') {
    $where[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    $like = '%' . addcslashes($qText, '%_\\') . '%';
    array_push($args, $like, $like, $like);
}
if ($status === 'inactive') { $where[] = "status IN ('inactive','rejected')"; }
elseif (in_array($status, ['pending', 'active', 'rejected'], true)) { $where[] = 'status = ?'; $args[] = $status; }
if (isset(ROLE_RANK[$role])) { $where[] = 'role = ?'; $args[] = $role; }
$sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$total = (int)q("SELECT COUNT(*) FROM users $sqlWhere", $args)->fetchColumn();
$pages = max(1, (int)ceil($total / $per));
$page  = min($page, $pages);
$users = q("SELECT id, name, email, phone, role, status, google_id, last_login_at, created_at FROM users $sqlWhere
            ORDER BY FIELD(status,'pending','active','inactive','rejected'), created_at DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args)->fetchAll();

$qs = fn(array $o) => '?' . http_build_query(array_filter(array_merge(['q' => $qText, 'status' => $status, 'role' => $role], $o)));

page_head('Users', ['nav' => 'admin']);
?>
<div class="page-h"><h1>Users</h1><span class="muted small"><?= $total ?> found</span></div>
<?php admin_tabs($me, 'users'); ?>

<form class="filters" method="get">
  <input type="search" name="q" value="<?= e($qText) ?>" placeholder="Search name, email or mobile" aria-label="Search">
  <select name="status" aria-label="Status" onchange="this.form.submit()">
    <option value="">All statuses</option>
    <?php foreach (['pending' => 'Pending', 'active' => 'Active', 'inactive' => 'Inactive', 'rejected' => 'Rejected'] as $k => $l): ?>
    <option value="<?= $k ?>" <?= $status === $k ? 'selected' : '' ?>><?= $l ?></option>
    <?php endforeach; ?>
  </select>
  <select name="role" aria-label="Role" onchange="this.form.submit()">
    <option value="">All roles</option>
    <?php foreach (ROLE_LABELS as $k => $l): ?><option value="<?= $k ?>" <?= $role === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?>
  </select>
  <button class="btn btn-line" type="submit">Search</button>
</form>

<div class="card tcard">
<?php if (!$users): ?>
  <div class="empty">No users match your filters.</div>
<?php else: ?>
  <table class="rt">
    <thead><tr><th>User</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
    <tbody>
<?php foreach ($users as $r): ?>
      <tr>
        <td class="who"><b><?= e($r['name']) ?></b><span><?= e($r['email']) ?></span></td>
        <td data-l="Mobile"><?= e($r['phone'] ?: '—') ?></td>
        <td data-l="Role"><?= badge($r['role'], ROLE_LABELS[$r['role']] ?? $r['role']) ?></td>
        <td data-l="Status"><?= badge($r['status']) ?></td>
        <td data-l="Last login"><?= e(fmt_dt($r['last_login_at'])) ?></td>
        <td class="acts"><div class="row-actions"><a class="btn btn-sm btn-line" href="<?= url('admin/user.php?id=' . $r['id']) ?>"><?= can_manage($me, $r) ? 'Manage' : 'View' ?></a></div></td>
      </tr>
<?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
</div>

<?php if ($pages > 1): ?>
<div class="pager">
  <?php if ($page > 1): ?><a class="btn btn-sm btn-line" href="<?= e($qs(['p' => $page - 1])) ?>">← Prev</a><?php endif; ?>
  <span class="muted">Page <?= $page ?> of <?= $pages ?></span>
  <?php if ($page < $pages): ?><a class="btn btn-sm btn-line" href="<?= e($qs(['p' => $page + 1])) ?>">Next →</a><?php endif; ?>
</div>
<?php endif; ?>
<?php page_foot();
