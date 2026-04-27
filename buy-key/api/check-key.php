<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/csrf.php';
require_once __DIR__ . '/../includes/worker.php';

require_post();

$input = wants_json() ? array_merge($_POST, read_json_body()) : $_POST;
require_csrf($input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));

try {
    $key = trim((string) ($input['key'] ?? ''));
    $workerResponse = worker_check_key($key);
    $rawStatus = $workerResponse['status'] ?? ($workerResponse['state'] ?? null);

    json_response([
        'ok' => true,
        'message' => $workerResponse['message'] ?? 'Đã kiểm tra key qua Worker.',
        'display_status' => is_scalar($rawStatus) ? key_status_label((string) $rawStatus) : null,
        'worker_response' => $workerResponse,
    ]);
} catch (Throwable $e) {
    json_response(['ok' => false, 'message' => app_error_message($e)], 422);
}
