<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/payment.php';

function webhook_request_headers(): array
{
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        return is_array($headers) ? $headers : [];
    }

    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
            $headers[$name] = $value;
        }
    }

    foreach ([
        'CONTENT_TYPE' => 'Content-Type',
        'CONTENT_LENGTH' => 'Content-Length',
        'AUTHORIZATION' => 'Authorization',
        'REDIRECT_HTTP_AUTHORIZATION' => 'Authorization',
    ] as $key => $name) {
        if (isset($_SERVER[$key])) {
            $headers[$name] = $_SERVER[$key];
        }
    }

    return $headers;
}

function webhook_file_log(array $payload): void
{
    $line = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($line === false) {
        $line = json_encode([
            'time' => date('c'),
            'error' => 'Could not encode webhook file log payload.',
            'json_error' => json_last_error_msg(),
        ], JSON_UNESCAPED_SLASHES);
    }

    @file_put_contents(__DIR__ . '/webhook-debug.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

$rawBody = file_get_contents('php://input');
$rawBody = $rawBody === false ? '' : $rawBody;
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$allowGetSimulation = $method === 'GET' && app_debug_enabled();

$decodedJson = json_decode($rawBody, true);
$jsonIsValid = is_array($decodedJson);
try {
    $requestEntropy = bin2hex(random_bytes(4));
} catch (Throwable $e) {
    $requestEntropy = substr(hash('sha256', uniqid('', true)), 0, 8);
}

$requestId = 'req_' . date('YmdHis') . '_' . str_replace('.', '', sprintf('%.6F', microtime(true))) . '_' . $requestEntropy;

$requestLog = [
    'request_id' => $requestId,
    'method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
    'uri' => $_SERVER['REQUEST_URI'] ?? '',
    'query_string' => $_SERVER['QUERY_STRING'] ?? '',
    'headers' => webhook_request_headers(),
    'get' => $_GET,
    'post' => $_POST,
    'raw_body' => $rawBody,
    'json_decode' => $jsonIsValid ? $decodedJson : null,
    'json_valid' => $jsonIsValid,
    'json_error' => $jsonIsValid ? null : json_last_error_msg(),
    'received_at' => date('c'),
    'received_microtime' => microtime(true),
    'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? null,
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
];

$payload = [
    '_request' => $requestLog,
    'json' => $jsonIsValid ? $decodedJson : null,
    'post' => $_POST,
    'raw_body' => $rawBody,
];

$normalizationPayload = [];

if ($jsonIsValid) {
    $payload = array_merge($decodedJson, $payload);
    $normalizationPayload = array_merge($normalizationPayload, $decodedJson);
}

if (!empty($_POST)) {
    $payload = array_merge($_POST, $payload);
    $normalizationPayload = array_merge($normalizationPayload, $_POST);
}

if ($allowGetSimulation) {
    $payload['get'] = $_GET;
    $normalizationPayload = array_merge($normalizationPayload, $_GET);
}

$normalizationPayload['_meta'] = [
    'method' => $method,
    'received_at' => $requestLog['received_at'],
];
$event = normalize_payment_payload($normalizationPayload, $rawBody);
$event['event_id'] = $requestId;
$event['provider'] = (string) (app_config()['PAYMENT_PROVIDER'] ?? 'sepay');
if (empty($event['reference'])) {
    $event['reference'] = $event['event_id'];
}

$payload['_webhook_debug'] = [
    'mode' => 'No_Authen',
    'auth_skipped' => true,
    'event_id' => $event['event_id'],
    'http_method' => $method,
    'get_simulation_allowed' => $allowGetSimulation,
    'amount_detected' => $event['amount'],
    'transfer_content_detected' => $event['transfer_content'],
];

$pdo = null;
$eventRow = null;

try {
    $pdo = db();
    $eventRow = record_payment_event($pdo, $event, $payload);
} catch (Throwable $e) {
    webhook_file_log([
        'level' => 'error',
        'message' => 'Could not write webhook to payment_events.',
        'error' => $e->getMessage(),
        'payload' => $payload,
    ]);

    json_response([
        'ok' => false,
        'logged' => false,
        'file_logged' => true,
        'message' => 'Webhook received but database logging failed.',
        'error' => app_error_message($e),
    ], 500);
}

if (empty($eventRow['id'])) {
    webhook_file_log([
        'level' => 'error',
        'message' => 'payment_events insert returned no row.',
        'event' => $event,
        'payload' => $payload,
    ]);

    json_response([
        'ok' => false,
        'logged' => false,
        'file_logged' => true,
        'message' => 'Webhook received but payment_events row was not created.',
        'event_id' => $event['event_id'],
    ], 500);
}

if (isset($_GET['test'])) {
    append_payment_event_debug($pdo, (int) $eventRow['id'], [
        'process_result' => 'test_logged_only',
        'message' => 'Test request logged only. No payment processing was attempted.',
        'detected_amount' => $event['amount'],
        'detected_content' => $event['transfer_content'],
    ]);

    json_response([
        'ok' => true,
        'logged' => true,
        'message' => 'Webhook test request logged.',
        'event_id' => $event['event_id'],
        'payment_event_id' => (int) $eventRow['id'],
    ]);
}

if ($method !== 'POST' && !$allowGetSimulation) {
    append_payment_event_debug($pdo, (int) $eventRow['id'], [
        'process_result' => 'ignored_non_post',
        'message' => 'Only POST webhooks are processed when APP_DEBUG is false.',
        'detected_amount' => $event['amount'],
        'detected_content' => $event['transfer_content'],
    ]);

    json_response([
        'ok' => true,
        'logged' => true,
        'processed' => false,
        'message' => 'Webhook logged only. Non-POST requests are not processed in production.',
        'event_id' => $event['event_id'],
        'payment_event_id' => (int) $eventRow['id'],
    ]);
}

$debugMatch = trim((string) ($_GET['debug_match'] ?? ''));
if ($debugMatch !== '' && app_debug_enabled()) {
    $stmt = $pdo->prepare(
        'SELECT public_id, email, plan_code, duration, amount, currency, status, transfer_content,
                payment_provider, payment_reference, generated_key, created_at, paid_at, key_generated_at
         FROM orders
         WHERE transfer_content = ?
         LIMIT 1'
    );
    $stmt->execute([$debugMatch]);
    $debugOrder = $stmt->fetch();

    append_payment_event_debug($pdo, (int) $eventRow['id'], [
        'debug_match' => $debugMatch,
        'debug_order_found' => (bool) $debugOrder,
        'process_result' => 'debug_match_logged_only',
    ]);

    json_response([
        'ok' => (bool) $debugOrder,
        'logged' => true,
        'message' => $debugOrder ? 'Debug order found. No payment was applied.' : 'Debug order not found.',
        'event_id' => $event['event_id'],
        'payment_event_id' => (int) $eventRow['id'],
        'order' => $debugOrder ? [
            'public_id' => $debugOrder['public_id'],
            'plan_code' => $debugOrder['plan_code'],
            'duration' => $debugOrder['duration'],
            'amount' => (float) $debugOrder['amount'],
            'currency' => $debugOrder['currency'],
            'status' => $debugOrder['status'],
            'transfer_content' => $debugOrder['transfer_content'],
            'payment_provider' => $debugOrder['payment_provider'],
            'payment_reference' => $debugOrder['payment_reference'],
            'has_generated_key' => !empty($debugOrder['generated_key']),
            'created_at' => $debugOrder['created_at'],
            'paid_at' => $debugOrder['paid_at'],
            'key_generated_at' => $debugOrder['key_generated_at'],
        ] : null,
    ]);
}

$order = null;

try {
    $order = find_order_for_payment_event($pdo, $event);
    if (!$order) {
        append_payment_event_debug($pdo, (int) $eventRow['id'], [
            'process_result' => 'no_matching_order',
            'message' => 'No matching order found',
            'scanned_strings' => $event['all_strings'],
            'detected_amount' => $event['amount'],
            'detected_content' => $event['transfer_content'],
        ]);

        json_response([
            'ok' => false,
            'logged' => true,
            'processed' => false,
            'message' => 'No matching order found',
            'detected_content' => $event['transfer_content'],
            'detected_amount' => $event['amount'],
            'event_id' => $event['event_id'],
            'payment_event_id' => (int) $eventRow['id'],
        ]);
    }

    $event['amount'] = detect_payment_amount_for_order($event, $order);

    append_payment_event_debug($pdo, (int) $eventRow['id'], [
        'matched_order_public_id' => $order['public_id'] ?? null,
        'matched_transfer_content' => $order['transfer_content'] ?? null,
        'detected_amount' => $event['amount'],
        'detected_content' => $event['transfer_content'],
    ]);

    if ($event['amount'] !== null && (float) $event['amount'] + 0.01 < (float) $order['amount']) {
        append_payment_event_debug($pdo, (int) $eventRow['id'], [
            'process_result' => 'amount_too_low',
            'message' => 'Amount is lower than order amount',
            'detected_amount' => $event['amount'],
            'order_amount' => (float) $order['amount'],
            'matched_order_public_id' => $order['public_id'] ?? null,
            'matched_transfer_content' => $order['transfer_content'] ?? null,
        ]);

        json_response([
            'ok' => false,
            'logged' => true,
            'processed' => false,
            'message' => 'Amount is lower than order amount',
            'detected_amount' => $event['amount'],
            'order_amount' => (float) $order['amount'],
            'event_id' => $event['event_id'],
            'payment_event_id' => (int) $eventRow['id'],
            'order_id' => $order['public_id'] ?? null,
            'matched_order' => $order['transfer_content'] ?? null,
        ]);
    }

    $pdo->beginTransaction();
    $updatedOrder = apply_payment_to_order($pdo, $order, $event);
    $pdo->commit();

    if (($updatedOrder['status'] ?? '') === 'paid') {
        $alreadyHadKey = !empty($updatedOrder['generated_key']);
        $pdo->beginTransaction();
        $lockedOrder = lock_order_by_id($pdo, (int) $updatedOrder['id']);
        if (!$lockedOrder) {
            throw new RuntimeException('Order not found after payment update.');
        }

        $alreadyHadKey = $alreadyHadKey || !empty($lockedOrder['generated_key']);
        $updatedOrder = generate_key_for_paid_order($pdo, $lockedOrder);
        mark_payment_event_processed($pdo, (int) $eventRow['id']);
        $pdo->commit();

        append_payment_event_debug($pdo, (int) $eventRow['id'], [
            'process_result' => 'payment_processed',
            'processed' => true,
            'order_status' => $updatedOrder['status'] ?? null,
            'key_generated' => !empty($updatedOrder['generated_key']),
            'key_already_existed' => $alreadyHadKey,
        ]);

        json_response([
            'ok' => true,
            'logged' => true,
            'processed' => true,
            'message' => $alreadyHadKey ? 'Order already paid.' : 'Payment confirmed and key generated.',
            'event_id' => $event['event_id'],
            'payment_event_id' => (int) $eventRow['id'],
            'order_id' => $updatedOrder['public_id'] ?? null,
            'matched_order' => $updatedOrder['transfer_content'] ?? null,
            'status' => $updatedOrder['status'] ?? null,
            'key_generated' => !empty($updatedOrder['generated_key']),
        ]);
    } else {
        append_payment_event_debug($pdo, (int) $eventRow['id'], [
            'process_result' => 'order_not_marked_paid',
            'order_id' => $updatedOrder['public_id'] ?? null,
            'order_status' => $updatedOrder['status'] ?? null,
            'message' => 'Order matched but was not marked paid.',
        ]);
    }

    json_response([
        'ok' => false,
        'logged' => true,
        'processed' => false,
        'message' => 'Order matched but was not marked paid.',
        'event_id' => $event['event_id'],
        'payment_event_id' => (int) $eventRow['id'],
        'order_id' => $updatedOrder['public_id'] ?? null,
        'matched_order' => $updatedOrder['transfer_content'] ?? null,
        'status' => $updatedOrder['status'] ?? null,
        'key_generated' => !empty($updatedOrder['generated_key']),
    ]);
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    append_payment_event_debug($pdo, (int) $eventRow['id'], [
        'process_result' => 'processing_failed',
        'message' => $e->getMessage(),
        'worker_error' => (stripos($e->getMessage(), 'worker') !== false || stripos($e->getMessage(), 'WORKER_ADMIN_KEY') !== false) ? $e->getMessage() : null,
        'matched_order_public_id' => $order['public_id'] ?? null,
        'matched_transfer_content' => $order['transfer_content'] ?? null,
        'detected_amount' => $event['amount'],
        'detected_content' => $event['transfer_content'],
    ]);

    $isWorkerError = stripos($e->getMessage(), 'worker') !== false || stripos($e->getMessage(), 'WORKER_ADMIN_KEY') !== false;
    if ($isWorkerError && !empty($order['id'])) {
        try {
            store_order_worker_error($pdo, (int) $order['id'], $e);
        } catch (Throwable $storeError) {
            webhook_file_log([
                'level' => 'error',
                'message' => 'Could not store Worker error on order.',
                'order_id' => $order['public_id'] ?? null,
                'error' => $storeError->getMessage(),
            ]);
        }
    }

    json_response([
        'ok' => false,
        'logged' => true,
        'processed' => false,
        'message' => $isWorkerError ? 'Worker key generation failed.' : app_error_message($e),
        'detail' => app_debug_enabled() ? app_error_message($e) : null,
        'matched_order' => $order['transfer_content'] ?? null,
        'detected_content' => $event['transfer_content'],
        'detected_amount' => $event['amount'],
        'event_id' => $event['event_id'],
        'payment_event_id' => (int) $eventRow['id'],
    ]);
}
