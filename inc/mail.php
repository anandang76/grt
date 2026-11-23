<?php
/* Minimal SMTP mailer (no dependencies). Works with Gmail + App Password.
   If mail.pass is empty, messages are appended to storage/mail.log (dev mode). */

function send_mail(string $to, string $subject, string $html): bool
{
    if (!valid_email($to)) return false;
    $m = cfg('mail', []);
    if (empty($m['pass']) || empty($m['host'])) {
        $text = html_entity_decode(strip_tags(preg_replace('#<(br|/p|/h\d)>#i', "\n", $html)));
        @file_put_contents(ROOT . '/storage/mail.log',
            sprintf("[%s] TO: %s\nSUBJECT: %s\n%s\n%s\n\n", date('c'), $to, $subject, trim($text), str_repeat('-', 60)),
            FILE_APPEND | LOCK_EX);
        return true;
    }
    try {
        return smtp_send($m, $to, $subject, $html);
    } catch (Throwable $ex) {
        error_log('[mail] ' . $ex->getMessage());
        return false;
    }
}

function mime_header(string $s): string { return '=?UTF-8?B?' . base64_encode($s) . '?='; }

function smtp_send(array $m, string $to, string $subject, string $html): bool
{
    $secure = $m['secure'] ?? 'tls';
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $m['host'] . ':' . $m['port'], $errno, $errstr, 15);
    if (!$fp) throw new RuntimeException("SMTP connect failed: $errstr");
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function (string $c, array $ok) use ($fp, $read): string {
        if ($c !== '') fwrite($fp, $c . "\r\n");
        $r = $read();
        if (!in_array((int)substr($r, 0, 3), $ok, true)) {
            throw new RuntimeException('SMTP error after ' . ($c === '' ? 'connect' : strtok($c, ' ')) . ': ' . trim($r));
        }
        return $r;
    };

    $ehlo = 'EHLO ' . (gethostname() ?: 'localhost');
    $cmd('', [220]);
    $cmd($ehlo, [250]);
    if ($secure === 'tls') {
        $cmd('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
            throw new RuntimeException('STARTTLS failed');
        }
        $cmd($ehlo, [250]);
    }
    $cmd('AUTH LOGIN', [334]);
    $cmd(base64_encode($m['user']), [334]);
    $cmd(base64_encode($m['pass']), [235]);
    $cmd('MAIL FROM:<' . $m['from_email'] . '>', [250]);
    $cmd('RCPT TO:<' . $to . '>', [250, 251]);
    $cmd('DATA', [354]);

    $domain = substr(strrchr($m['from_email'], '@'), 1) ?: 'localhost';
    $headers = [
        'Date: ' . date('r'),
        'From: ' . mime_header($m['from_name']) . ' <' . $m['from_email'] . '>',
        'To: <' . $to . '>',
        'Subject: ' . mime_header($subject),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    $cmd(implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n.", [250]);
    fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return true;
}

function mail_tpl(string $title, string $body): string
{
    $app = e(cfg('app_name'));
    return '<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#16181d">'
        . '<div style="max-width:520px;margin:0 auto;padding:24px">'
        . '<div style="font-weight:700;font-size:18px;margin-bottom:16px"><span style="background:#2563eb;color:#fff;border-radius:6px;padding:3px 7px;font-size:13px">GR</span> ' . $app . '</div>'
        . '<div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e3e6eb">'
        . '<h2 style="margin:0 0 12px;font-size:18px">' . e($title) . '</h2>' . $body . '</div>'
        . '<p style="color:#8a909c;font-size:12px;margin-top:16px">' . $app . ' · Maintained by GRFinTech · grfintech.in</p>'
        . '</div></body></html>';
}
