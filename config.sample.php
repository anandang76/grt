<?php
// Copy to config.php and edit. config.php is git-ignored.
return [
    'app_name' => 'GR Trading',
    'base_url' => 'http://localhost/GRT',   // no trailing slash
    'debug'    => true,                     // false in production
    'timezone' => 'Asia/Kolkata',
    'secret'   => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',

    'db' => [
        'host'   => '127.0.0.1',
        'port'   => 3306,
        'socket' => '/Applications/MAMP/tmp/mysql/mysql.sock', // leave '' to use host/port
        'name'   => 'grt',
        'user'   => 'root',
        'pass'   => 'root',
    ],

    // Gmail: create an App Password at https://myaccount.google.com/apppasswords
    // If 'pass' is empty, emails are written to storage/mail.log instead of being sent (dev mode).
    'mail' => [
        'from_email' => 'you@example.com',
        'from_name'  => 'GR Trading',
        'host'       => 'smtp.gmail.com',
        'port'       => 587,
        'secure'     => 'tls',   // tls (587) or ssl (465)
        'user'       => 'you@example.com',
        'pass'       => '',
    ],

    // Google Identity Services OAuth Client ID (Web). Empty = Google button hidden.
    'google_client_id' => '',
];
