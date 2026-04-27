<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/worker.php';

$token = trim((string) ($_GET['token'] ?? ''));

if ($token === '' || strlen($token) > 128 || !verify_free_callback_token($token)) {
    http_response_code(403);
    exit('Liên kết xác minh key miễn phí không hợp lệ hoặc đã hết hạn.');
}

$pdo = db();

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT * FROM free_claims WHERE token = ? FOR UPDATE');
    $stmt->execute([$token]);
    $claim = $stmt->fetch();

    if (!$claim) {
        throw new RuntimeException('Không tìm thấy lượt nhận key miễn phí.');
    }

    if (($claim['status'] ?? '') === 'completed' && !empty($claim['generated_key'])) {
        $pdo->commit();
        redirect(site_url('/free-success.php?id=' . urlencode((string) $claim['public_id'])));
    }

    if (($claim['status'] ?? '') !== 'pending') {
        throw new RuntimeException('Lượt nhận key miễn phí này không còn khả dụng.');
    }

    $hours = (int) (app_config()['FREE_RATE_LIMIT_HOURS'] ?? 24);
    if ((string) $claim['created_at'] < cutoff_datetime($hours)) {
        $expire = $pdo->prepare('UPDATE free_claims SET status = "expired" WHERE id = ?');
        $expire->execute([(int) $claim['id']]);
        $pdo->commit();
        redirect(site_url('/free.php?error=' . urlencode('Lượt nhận key miễn phí đã hết hạn. Vui lòng bắt đầu lại.')));
    }

    if (free_claim_rate_limited($pdo, (string) $claim['email'], (string) $claim['ip_address'], (int) $claim['id'])) {
        throw new InvalidArgumentException('Email hoặc địa chỉ IP này đã đạt giới hạn nhận key miễn phí.');
    }

    $created = worker_create_key('free', '1d', 1, 'free link claim ' . (int) $claim['id']);

    $update = $pdo->prepare(
        'UPDATE free_claims
         SET status = "completed", generated_key = ?, worker_response = ?, completed_at = NOW(), key_generated_at = NOW()
         WHERE id = ? AND generated_key IS NULL'
    );
    $update->execute([
        $created['key'],
        json_encode($created['response'], JSON_UNESCAPED_SLASHES),
        (int) $claim['id'],
    ]);

    $pdo->commit();

    start_secure_session();
    unset($_SESSION['free_claim_token'], $_SESSION['free_claim_public_id']);

    redirect(site_url('/free-success.php?id=' . urlencode((string) $claim['public_id'])));
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(422);
    echo e(app_error_message($e));
}
