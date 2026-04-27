<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/worker.php';

require_admin();
require_post();

$input = wants_json() ? array_merge($_POST, read_json_body()) : $_POST;
require_csrf($input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));

try {
    $tier = trim((string) ($input['tier'] ?? ''));
    $duration = trim((string) ($input['duration'] ?? ''));
    $note = trim((string) ($input['note'] ?? 'manual admin key'));
    $quantity = max(1, (int) ($input['quantity'] ?? 1));

    $created = worker_create_key($tier, $duration, $quantity, $note);

    json_response([
        'ok' => true,
        'key' => $created['key'],
        'worker_response' => $created['response'],
    ]);
} catch (Throwable $e) {
    json_response(['ok' => false, 'message' => app_error_message($e)], 422);
}
