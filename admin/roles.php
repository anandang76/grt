<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('superadmin');

$roles = q('SELECT r.*, COUNT(u.id) total, SUM(u.status = \'active\') active
            FROM roles r LEFT JOIN users u ON u.role = r.slug GROUP BY r.slug ORDER BY r.rank_no DESC')->fetchAll();

$perms = [
    'Access trading terminal'           => ['user', 'admin', 'superadmin'],
    'View users list'                   => ['admin', 'superadmin'],
    'Approve or reject signups'         => ['admin', 'superadmin'],
    'Activate or deactivate users'      => ['admin', 'superadmin'],
    'Manage admins'                     => ['superadmin'],
    'Reset user passwords'              => ['superadmin'],
    'Change user roles'                 => ['superadmin'],
    'View activity log'                 => ['superadmin'],
];

page_head('Roles', ['nav' => 'admin']);
?>
<div class="page-h"><h1>Roles</h1></div>
<?php admin_tabs($me, 'roles'); ?>

<div class="card tcard">
  <table class="rt">
    <thead><tr><th>Role</th><th>Description</th><th>Users</th><th>Active</th><th></th></tr></thead>
    <tbody>
<?php foreach ($roles as $r): ?>
      <tr>
        <td class="who"><?= badge($r['slug'], $r['name']) ?></td>
        <td data-l="Description"><?= e($r['description']) ?></td>
        <td data-l="Users"><?= (int)$r['total'] ?></td>
        <td data-l="Active"><?= (int)$r['active'] ?></td>
        <td class="acts"><div class="row-actions"><a class="btn btn-sm btn-line" href="<?= url('admin/users.php?role=' . $r['slug']) ?>">View users</a></div></td>
      </tr>
<?php endforeach; ?>
    </tbody>
  </table>
</div>

<div class="card tcard" style="margin-top:16px">
  <div class="tcard-h"><h2>Permissions</h2></div>
  <table class="rt">
    <thead><tr><th>Permission</th><?php foreach (array_reverse(ROLE_LABELS) as $l): ?><th><?= $l ?></th><?php endforeach; ?></tr></thead>
    <tbody>
<?php foreach ($perms as $p => $who): ?>
      <tr><td class="who"><?= e($p) ?></td>
      <?php foreach (array_reverse(ROLE_LABELS) as $k => $l): ?><td data-l="<?= $l ?>"><?= in_array($k, $who, true) ? '<span class="up">✓</span>' : '<span class="muted">—</span>' ?></td><?php endforeach; ?></tr>
<?php endforeach; ?>
    </tbody>
  </table>
</div>
<p class="muted small">Promote a user to Admin from their page under Users. Super Admins are created from the command line with <code>php install.php</code>.</p>
<?php page_foot();
