<?php
require __DIR__ . '/../inc/bootstrap.php';
$me = require_role('admin', 'superadmin');
if (!is_post()) redirect('admin/');
csrf_verify();

$id   = (int)($_POST['id'] ?? 0);
$do   = (string)($_POST['do'] ?? '');
$back = (string)($_POST['back'] ?? '');
if (!preg_match('#^admin/([a-z]+\.php)?(\?[A-Za-z0-9=&%._-]*)?$#', $back)) $back = 'admin/user.php?id=' . $id;

$t = find_user($id);
if (!$t || !can_manage($me, $t)) { flash('err', 'You cannot manage this user.'); redirect($back); }
if (in_array($do, ['reset_password', 'set_role'], true) && !is_super($me)) { flash('err', 'Only a Super Admin can do that.'); redirect($back); }

$set = function (string $status, string $from) use ($t): void {
    q('UPDATE users SET status = ?, approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, ?), updated_at = ? WHERE id = ?',
      [$status, $status === 'active' ? $_SESSION['uid'] : null, $status === 'active' ? now() : null, now(), $t['id']]);
    audit('status_' . $status, (int)$t['id'], ['from' => $from]);
};

switch ($do) {
    case 'approve':
        if ($t['status'] !== 'pending') { flash('err', 'This user is not pending approval.'); break; }
        $set('active', 'pending');
        send_mail($t['email'], 'Your ' . cfg('app_name') . ' account is approved', mail_tpl('Welcome, ' . $t['name'] . '!',
            '<p>Your account has been approved. You can now log in.</p><p><a href="' . e(url('login.php')) . '" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Log in</a></p>'));
        flash('ok', "{$t['name']} approved and notified by email.");
        break;

    case 'reject':
        if ($t['status'] !== 'pending') { flash('err', 'This user is not pending approval.'); break; }
        $set('rejected', 'pending');
        send_mail($t['email'], 'Your ' . cfg('app_name') . ' signup', mail_tpl('Signup update',
            '<p>We are unable to approve your account at this time. Please contact support if you think this is a mistake.</p>'));
        flash('ok', "{$t['name']} rejected.");
        break;

    case 'activate':
        if ($t['status'] === 'active' || $t['status'] === 'pending') { flash('err', 'Nothing to change.'); break; }
        $set('active', $t['status']);
        flash('ok', "{$t['name']} is now active.");
        break;

    case 'deactivate':
        if ($t['status'] !== 'active') { flash('err', 'User is not active.'); break; }
        $set('inactive', 'active');
        flash('ok', "{$t['name']} has been deactivated.");
        break;

    case 'reset_password':
        $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $temp = '';
            for ($i = 0; $i < 10; $i++) $temp .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        } while (password_problem($temp));
        q('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?',
          [password_hash($temp, PASSWORD_DEFAULT), now(), $t['id']]);
        audit('password_reset_admin', (int)$t['id']);
        $sent = send_mail($t['email'], 'Your ' . cfg('app_name') . ' password was reset', mail_tpl('Password reset',
            '<p>An administrator reset your password. Your temporary password is:</p>'
            . '<p style="font-size:20px;font-weight:700;font-family:monospace;margin:12px 0">' . e($temp) . '</p>'
            . '<p>You will be asked to set a new password when you log in.</p>'));
        flash('ok', "Temporary password for {$t['email']}: $temp" . ($sent ? ' (emailed to the user).' : ' (email failed, so share it securely).'));
        break;

    case 'set_role':
        $role = (string)($_POST['role'] ?? '');
        if (!in_array($role, ['user', 'admin'], true) || $role === $t['role']) { flash('err', 'Nothing to change.'); break; }
        q('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [$role, now(), $t['id']]);
        audit('role_change', (int)$t['id'], ['from' => $t['role'], 'to' => $role]);
        flash('ok', "{$t['name']} is now " . ROLE_LABELS[$role] . '.');
        break;

    default:
        flash('err', 'Unknown action.');
}
redirect($back);
