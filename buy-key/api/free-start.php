<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

require_post();
require_csrf();

try {
    $pdo = db();
    $customer = current_customer();
    $email = $customer ? normalize_email((string) $customer['email']) : normalize_email((string) ($_POST['email'] ?? ''));
    $customerId = $customer ? (int) $customer['id'] : null;
    $ip = client_ip();

    if (!valid_email($email)) {
        throw new InvalidArgumentException('Vui lòng nhập địa chỉ email hợp lệ.');
    }

    if (free_claim_rate_limited($pdo, $email, $ip)) {
        throw new InvalidArgumentException('Email hoặc địa chỉ IP này vừa nhận key miễn phí gần đây. Vui lòng thử lại sau.');
    }

    $publicId = random_token(16);
    $token = random_token(32);

    if ($customerId !== null && db_column_exists($pdo, 'free_claims', 'customer_id')) {
        $stmt = $pdo->prepare(
            'INSERT INTO free_claims (customer_id, public_id, email, token, status, ip_address, user_agent, created_at)
             VALUES (?, ?, ?, ?, "pending", ?, ?, NOW())'
        );
        $stmt->execute([
            $customerId,
            $publicId,
            $email,
            $token,
            $ip,
            substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 2000),
        ]);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO free_claims (public_id, email, token, status, ip_address, user_agent, created_at)
             VALUES (?, ?, ?, "pending", ?, ?, NOW())'
        );
        $stmt->execute([
            $publicId,
            $email,
            $token,
            $ip,
            substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 2000),
        ]);
    }

    start_secure_session();
    $_SESSION['free_claim_token'] = $token;
    $_SESSION['free_claim_public_id'] = $publicId;

    redirect(build_free_link_url($token));
} catch (Throwable $e) {
    redirect(site_url('/free.php?error=' . urlencode(app_error_message($e))));
}
