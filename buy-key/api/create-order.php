<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

require_post();

$input = wants_json() ? array_merge($_POST, read_json_body()) : $_POST;
require_csrf($input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));

try {
    $customer = current_customer();
    $email = $customer ? normalize_email((string) $customer['email']) : normalize_email((string) ($input['email'] ?? ''));
    $customerId = $customer ? (int) $customer['id'] : null;
    $planCode = trim((string) ($input['plan_code'] ?? ''));

    if (!valid_email($email)) {
        throw new InvalidArgumentException('Vui lòng nhập địa chỉ email hợp lệ.');
    }

    if (!get_plan($planCode)) {
        throw new InvalidArgumentException('Gói Premium đã chọn không hợp lệ.');
    }

    $order = create_order(db(), $email, $planCode, $customerId);

    if (wants_json()) {
        json_response([
            'ok' => true,
            'order_id' => $order['public_id'],
            'redirect' => site_url('/checkout.php?id=' . urlencode($order['public_id'])),
        ]);
    }

    redirect(site_url('/checkout.php?id=' . urlencode($order['public_id'])));
} catch (Throwable $e) {
    if (wants_json()) {
        json_response(['ok' => false, 'message' => app_error_message($e)], 422);
    }

    $plan = isset($planCode) ? $planCode : '';
    redirect(site_url('/checkout.php?plan=' . urlencode($plan) . '&error=' . urlencode(app_error_message($e))));
}
