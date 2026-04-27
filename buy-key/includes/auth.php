<?php

declare(strict_types=1);

require_once __DIR__ . '/csrf.php';

function admin_allowed_email(string $email): bool
{
    $configured = app_config()['ADMIN_EMAILS'] ?? '';
    if (is_string($configured)) {
        $emails = array_filter(array_map('trim', explode(',', strtolower($configured))));
    } elseif (is_array($configured)) {
        $emails = array_map(static function ($value) {
            return strtolower(trim((string) $value));
        }, $configured);
    } else {
        $emails = [];
    }

    return empty($emails) || in_array(strtolower($email), $emails, true);
}

function current_admin(): ?array
{
    start_secure_session();
    return isset($_SESSION['admin_user']) && is_array($_SESSION['admin_user']) ? $_SESSION['admin_user'] : null;
}

function admin_logged_in(): bool
{
    return current_admin() !== null;
}

function require_admin(): void
{
    if (!admin_logged_in()) {
        redirect(site_url('/admin/login.php'));
    }
}

function login_admin(PDO $pdo, string $email, string $password): bool
{
    $email = normalize_email($email);
    if (!valid_email($email) || !admin_allowed_email($email)) {
        return false;
    }

    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, (string) $admin['password_hash'])) {
        return false;
    }

    start_secure_session();
    session_regenerate_id(true);
    $_SESSION['admin_user'] = [
        'id' => (int) $admin['id'],
        'email' => $admin['email'],
    ];

    return true;
}

function logout_admin(): void
{
    start_secure_session();
    unset($_SESSION['admin_user']);
    session_regenerate_id(true);
}
