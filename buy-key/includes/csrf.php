<?php

declare(strict_types=1);

require_once __DIR__ . '/functions.php';

function csrf_token(): string
{
    start_secure_session();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function csrf_valid(?string $token): bool
{
    start_secure_session();
    return is_string($token)
        && isset($_SESSION['csrf_token'])
        && hash_equals((string) $_SESSION['csrf_token'], $token);
}

function require_csrf(?string $token = null): void
{
    $token = $token ?? (string) ($_POST['csrf_token'] ?? '');
    if (!csrf_valid($token)) {
        if (wants_json()) {
            json_response(['ok' => false, 'message' => 'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang và thử lại.'], 419);
        }

        http_response_code(419);
        exit('Phiên bảo mật không hợp lệ. Vui lòng tải lại trang và thử lại.');
    }
}
