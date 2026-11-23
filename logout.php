<?php
require __DIR__ . '/inc/bootstrap.php';
if (is_post()) {
    csrf_verify();
    if (!empty($_SESSION['uid'])) audit('logout', (int)$_SESSION['uid']);
    logout_session();
    flash('ok', 'You have been logged out.');
}
redirect('login.php');
