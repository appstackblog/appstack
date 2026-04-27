<?php

declare(strict_types=1);

require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/mailer.php';

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

function verify_csrf(?string $token = null): void
{
    require_csrf($token);
}

function current_customer(): ?array
{
    start_secure_session();
    $customerId = (int) ($_SESSION['customer_id'] ?? 0);
    if ($customerId <= 0) {
        return null;
    }

    try {
        $stmt = db()->prepare('SELECT * FROM customers WHERE id = ? LIMIT 1');
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
    } catch (Throwable $e) {
        return null;
    }

    if (!$customer || ($customer['status'] ?? '') !== 'active') {
        unset($_SESSION['customer_id']);
        return null;
    }

    return $customer;
}

function is_customer_logged_in(): bool
{
    return current_customer() !== null;
}

function require_customer_login(): void
{
    if (!is_customer_logged_in()) {
        start_secure_session();
        $_SESSION['intended_url'] = $_SERVER['REQUEST_URI'] ?? site_url('/dashboard.php');
        redirect(site_url('/login.php'));
    }
}

function login_customer(array $customer): void
{
    start_secure_session();
    session_regenerate_id(true);
    $_SESSION['customer_id'] = (int) $customer['id'];
    unset($_SESSION['password_reset_email_verified'], $_SESSION['password_reset_email']);

    $stmt = db()->prepare('UPDATE customers SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?');
    $stmt->execute([(int) $customer['id']]);
}

function logout_customer(): void
{
    start_secure_session();
    unset($_SESSION['customer_id'], $_SESSION['intended_url'], $_SESSION['password_reset_email_verified'], $_SESSION['password_reset_email']);
    session_regenerate_id(true);
}

function find_customer_by_email(string $email): ?array
{
    $email = normalize_email($email);
    if (!valid_email($email)) {
        return null;
    }

    $stmt = db()->prepare('SELECT * FROM customers WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $customer = $stmt->fetch();

    return $customer ?: null;
}

function register_customer($email, $password, $name = null): array
{
    $email = normalize_email((string) $email);
    $password = (string) $password;
    $name = trim((string) $name);

    if (!valid_email($email)) {
        throw new InvalidArgumentException('Vui long nhap email hop le.');
    }

    if (strlen($password) < 8) {
        throw new InvalidArgumentException('Mat khau phai co toi thieu 8 ky tu.');
    }

    if (find_customer_by_email($email)) {
        throw new InvalidArgumentException('Email nay da co tai khoan. Vui long dang nhap.');
    }

    $stmt = db()->prepare(
        'INSERT INTO customers (email, password_hash, name, email_verified, status, created_at)
         VALUES (?, ?, ?, 0, "active", NOW())'
    );
    $stmt->execute([
        $email,
        password_hash($password, PASSWORD_DEFAULT),
        $name !== '' ? $name : null,
    ]);

    $customer = find_customer_by_email($email);
    if (!$customer) {
        throw new RuntimeException('Khong the tao tai khoan.');
    }

    return $customer;
}

function customer_otp_allowed(string $email, string $purpose): bool
{
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM email_otps
         WHERE email = ?
         AND purpose = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MINUTE)'
    );
    $stmt->execute([normalize_email($email), $purpose]);

    if ((int) $stmt->fetchColumn() >= 2) {
        return false;
    }

    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM email_otps
         WHERE ip_address = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)'
    );
    $stmt->execute([client_ip()]);

    return (int) $stmt->fetchColumn() < 10;
}

function send_customer_otp($email, $purpose): bool
{
    $email = normalize_email((string) $email);
    $purpose = (string) $purpose;
    if (!in_array($purpose, ['verify_email', 'reset_password', 'login_verify'], true)) {
        throw new InvalidArgumentException('Loai OTP khong hop le.');
    }

    if (!valid_email($email)) {
        throw new InvalidArgumentException('Email khong hop le.');
    }

    if (!customer_otp_allowed($email, $purpose)) {
        throw new InvalidArgumentException('Ban vua yeu cau OTP gan day. Vui long doi vai phut roi thu lai.');
    }

    $customer = find_customer_by_email($email);
    $otp = (string) random_int(100000, 999999);
    $stmt = db()->prepare(
        'INSERT INTO email_otps (customer_id, email, otp_hash, purpose, expires_at, ip_address, created_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, NOW())'
    );
    $stmt->execute([
        $customer['id'] ?? null,
        $email,
        password_hash($otp, PASSWORD_DEFAULT),
        $purpose,
        client_ip(),
    ]);

    $subject = 'Ma xac thuc tai khoan AppStack';
    $text = "Xin chao,\n\nMa OTP cua ban la: {$otp}\n\nMa nay co hieu luc trong 10 phut. Neu ban khong yeu cau ma nay, vui long bo qua email.";
    $html = '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">'
        . '<h2>Ma xac thuc tai khoan AppStack</h2>'
        . '<p>Xin chao,</p>'
        . '<p>Ma OTP cua ban la:</p>'
        . '<p style="font-size:28px;font-weight:700;letter-spacing:4px">' . e($otp) . '</p>'
        . '<p>Ma nay co hieu luc trong 10 phut. Neu ban khong yeu cau ma nay, vui long bo qua email.</p>'
        . '</div>';

    if (app_debug_enabled()) {
        mailer_log([
            'time' => date('c'),
            'email' => $email,
            'purpose' => $purpose,
            'otp' => $otp,
            'message' => 'APP_DEBUG enabled OTP fallback log.',
        ]);
    }

    try {
        return send_email($email, $subject, $html, $text);
    } catch (Throwable $e) {
        if (app_debug_enabled()) {
            mailer_log([
                'time' => date('c'),
                'email' => $email,
                'purpose' => $purpose,
                'otp' => $otp,
                'mail_error' => $e->getMessage(),
            ]);
            return true;
        }

        throw $e;
    }
}

function verify_customer_otp($email, $otp, $purpose): bool
{
    $email = normalize_email((string) $email);
    $otp = trim((string) $otp);
    $purpose = (string) $purpose;

    if (!preg_match('/^\d{6}$/', $otp)) {
        return false;
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT * FROM email_otps
         WHERE email = ?
         AND purpose = ?
         AND used_at IS NULL
         AND expires_at > NOW()
         ORDER BY id DESC
         LIMIT 1'
    );
    $stmt->execute([$email, $purpose]);
    $row = $stmt->fetch();

    if (!$row) {
        return false;
    }

    if ((int) $row['attempts'] >= 5) {
        return false;
    }

    $inc = $pdo->prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?');
    $inc->execute([(int) $row['id']]);

    if (!password_verify($otp, (string) $row['otp_hash'])) {
        return false;
    }

    $used = $pdo->prepare('UPDATE email_otps SET used_at = NOW() WHERE id = ? AND used_at IS NULL');
    $used->execute([(int) $row['id']]);

    return true;
}

function attach_existing_orders_to_customer($customerId, $email): void
{
    $pdo = db();
    $customerId = (int) $customerId;
    $email = normalize_email((string) $email);

    if ($customerId <= 0 || !valid_email($email)) {
        return;
    }

    if (db_column_exists($pdo, 'orders', 'customer_id')) {
        $stmt = $pdo->prepare('UPDATE orders SET customer_id = ? WHERE customer_id IS NULL AND LOWER(email) = ?');
        $stmt->execute([$customerId, $email]);
    }

    if (db_column_exists($pdo, 'free_claims', 'customer_id')) {
        $stmt = $pdo->prepare('UPDATE free_claims SET customer_id = ? WHERE customer_id IS NULL AND LOWER(email) = ?');
        $stmt->execute([$customerId, $email]);
    }
}
