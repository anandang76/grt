<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('superadmin');

$page  = max(1, (int)($_GET['p'] ?? 1));
$per   = 50;
$total = (int)q('SELECT COUNT(*) FROM audit_log')->fetchColumn();
$pages = max(1, (int)ceil($total / $per));
$rows  = q('SELECT a.*, ua.name actor_name, ut.name target_name FROM audit_log a
            LEFT JOIN users ua ON ua.id = a.actor_id LEFT JOIN users ut ON ut.id = a.target_id
            ORDER BY a.id DESC LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per))->fetchAll();

page_head('Activity', ['nav' => 'admin']);
?>
<div class="page-h"><h1>Activity log</h1><span class="muted small"><?= $total ?> events</span></div>
<?php admin_tabs($me, 'audit'); ?>

<div class="card tcard">
<?php if (!$rows): ?>
  <div class="empty">No activity yet.</div>
<?php else: ?>
  <table class="rt">
    <thead><tr><th>Event</th><th>By</th><th>User</th><th>When</th><th>IP</th></tr></thead>
    <tbody>
<?php foreach ($rows as $a): $m = $a['meta'] ? json_decode($a['meta'], true) : []; ?>
      <tr>
        <td class="who"><b><?= e(str_replace('_', ' ', $a['action'])) ?></b><?php if ($m): ?><span><?= e(implode(', ', array_map(fn($k, $v) => "$k: $v", array_keys($m), $m))) ?></span><?php endif; ?></td>
        <td data-l="By"><?= e($a['actor_name'] ?? '—') ?></td>
        <td data-l="User"><?= $a['target_id'] ? '<a href="' . url('admin/user.php?id=' . (int)$a['target_id']) . '">' . e($a['target_name'] ?? '#' . $a['target_id']) . '</a>' : '—' ?></td>
        <td data-l="When"><?= e(fmt_dt($a['created_at'])) ?></td>
        <td data-l="IP"><?= e($a['ip']) ?></td>
      </tr>
<?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
</div>
<?php if ($pages > 1): ?>
<div class="pager">
  <?php if ($page > 1): ?><a class="btn btn-sm btn-line" href="?p=<?= $page - 1 ?>">← Newer</a><?php endif; ?>
  <span class="muted">Page <?= $page ?> of <?= $pages ?></span>
  <?php if ($page < $pages): ?><a class="btn btn-sm btn-line" href="?p=<?= $page + 1 ?>">Older →</a><?php endif; ?>
</div>
<?php endif; ?>
<?php page_foot();
