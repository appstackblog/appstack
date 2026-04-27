<?php

declare(strict_types=1);

require_once __DIR__ . '/functions.php';

function mailer_log(array $payload): void
{
    $line = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($line === false) {
        $line = json_encode(['error' => 'Could not encode mail log payload.'], JSON_UNESCAPED_SLASHES);
    }

    @file_put_contents(dirname(__DIR__) . '/api/mail-debug.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function send_email(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
{
    $config = app_config();
    $driver = strtolower(trim((string) ($config['MAIL_DRIVER'] ?? 'mail')));
    $fromEmail = trim((string) ($config['MAIL_FROM_EMAIL'] ?? 'no-reply@appstack.blog'));
    $fromName = trim((string) ($config['MAIL_FROM_NAME'] ?? 'AppStack Buy Key'));

    if (!valid_email($to)) {
        throw new InvalidArgumentException('Dia chi email nhan khong hop le.');
    }

    if (!valid_email($fromEmail)) {
        throw new AppUserFacingException('MAIL_FROM_EMAIL chua hop le trong config.php.');
    }

    $textBody = $textBody !== '' ? $textBody : trim(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlBody)));

    if ($driver === 'smtp') {
        return send_email_smtp($to, $subject, $htmlBody, $textBody, $fromEmail, $fromName);
    }

    if ($driver !== 'mail') {
        throw new AppUserFacingException('MAIL_DRIVER khong duoc ho tro. Dung "mail" hoac "smtp".');
    }

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . mailer_address_header($fromEmail, $fromName),
        'Reply-To: ' . mailer_address_header($fromEmail, $fromName),
    ];

    $sent = @mail($to, $encodedSubject, $htmlBody, implode("\r\n", $headers));
    if (!$sent) {
        if (app_debug_enabled()) {
            mailer_log([
                'time' => date('c'),
                'to' => $to,
                'subject' => $subject,
                'html' => $htmlBody,
                'text' => $textBody,
                'message' => 'mail() failed. Configure SMTP or cPanel mail routing.',
            ]);
        }
        throw new AppUserFacingException('Khong the gui email. Vui long cau hinh SMTP/mail tren hosting.');
    }

    return true;
}

function mailer_address_header(string $email, string $name = ''): string
{
    if ($name === '') {
        return '<' . $email . '>';
    }

    return '=?UTF-8?B?' . base64_encode($name) . '?= <' . $email . '>';
}

function send_email_smtp(string $to, string $subject, string $htmlBody, string $textBody, string $fromEmail, string $fromName): bool
{
    $config = app_config();
    $host = trim((string) ($config['MAIL_HOST'] ?? ''));
    $port = (int) ($config['MAIL_PORT'] ?? 587);
    $username = (string) ($config['MAIL_USERNAME'] ?? '');
    $password = (string) ($config['MAIL_PASSWORD'] ?? '');
    $encryption = strtolower(trim((string) ($config['MAIL_ENCRYPTION'] ?? 'tls')));

    if ($host === '' || stripos($host, 'example.com') !== false || $username === '' || $password === '') {
        throw new AppUserFacingException('SMTP chua duoc cau hinh trong config.php.');
    }

    $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        throw new AppUserFacingException('Khong the ket noi SMTP: ' . $errstr);
    }

    stream_set_timeout($socket, 20);

    try {
        smtp_expect($socket, [220]);
        smtp_command($socket, 'EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'), [250]);

        if ($encryption === 'tls') {
            smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Khong the bat TLS cho SMTP.');
            }
            smtp_command($socket, 'EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'), [250]);
        }

        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($username), [334]);
        smtp_command($socket, base64_encode($password), [235]);
        smtp_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);

        $boundary = 'b' . bin2hex(random_bytes(12));
        $headers = [
            'From: ' . mailer_address_header($fromEmail, $fromName),
            'To: <' . $to . '>',
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n"
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
            . $textBody . "\r\n\r\n"
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
            . $htmlBody . "\r\n\r\n"
            . '--' . $boundary . "--\r\n.";

        smtp_command($socket, $message, [250]);
        smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }

    return true;
}

function smtp_command($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $expectedCodes);
}

function smtp_expect($socket, array $expectedCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP tra ve loi: ' . trim($response));
    }

    return $response;
}
