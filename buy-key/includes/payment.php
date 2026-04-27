<?php

declare(strict_types=1);

require_once __DIR__ . '/worker.php';

function request_header_value(string $name): string
{
    $target = strtolower($name);

    foreach ($_SERVER as $key => $value) {
        $normalized = strtolower(str_replace('_', '-', preg_replace('/^HTTP_/', '', $key)));
        if ($normalized === $target) {
            return trim((string) $value);
        }
    }

    if ($target === 'authorization') {
        return trim((string) ($_SERVER['AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
    }

    return '';
}

function payment_secret_is_configured(): bool
{
    $secret = trim((string) (app_config()['PAYMENT_WEBHOOK_SECRET'] ?? ''));
    return $secret !== '' && stripos($secret, 'change-me') === false;
}

function extract_payment_webhook_tokens(): array
{
    $tokens = [];

    foreach (['X-Webhook-Secret', 'X-API-Key', 'Api-Key', 'X-SePay-Api-Key'] as $header) {
        $value = request_header_value($header);
        if ($value !== '') {
            $tokens[] = $value;
        }
    }

    $authorization = request_header_value('Authorization');
    if ($authorization !== '') {
        $tokens[] = $authorization;
        if (preg_match('/^(apikey|api-key|api_key|bearer|token)\s+(.+)$/i', $authorization, $matches)) {
            $tokens[] = trim($matches[2]);
        }
    }

    return array_values(array_unique(array_filter($tokens, static function ($value) {
        return trim((string) $value) !== '';
    })));
}

function verify_payment_webhook(string $rawBody): bool
{
    $secret = trim((string) (app_config()['PAYMENT_WEBHOOK_SECRET'] ?? ''));

    if (!payment_secret_is_configured()) {
        return app_debug_enabled();
    }

    foreach (extract_payment_webhook_tokens() as $token) {
        if (hash_equals($secret, trim((string) $token))) {
            return true;
        }
    }

    $signature = request_header_value('X-Signature')
        ?: request_header_value('X-Payment-Signature')
        ?: request_header_value('X-PayOS-Signature')
        ?: request_header_value('X-Casso-Signature')
        ?: request_header_value('X-SePay-Signature');

    if ($signature !== '') {
        $signature = trim((string) preg_replace('/^sha256=/i', '', $signature));
        $expected = hash_hmac('sha256', $rawBody, $secret);
        if (hash_equals($expected, $signature)) {
            return true;
        }
    }

    return false;
}

function flatten_payload_values($value, string $path = ''): array
{
    $result = [
        'strings' => [],
        'numbers' => [],
        'scalars' => [],
    ];

    if (is_array($value)) {
        foreach ($value as $key => $child) {
            $childPath = $path === '' ? (string) $key : $path . '.' . (string) $key;
            $childValues = flatten_payload_values($child, $childPath);
            $result['strings'] = array_merge($result['strings'], $childValues['strings']);
            $result['numbers'] = array_merge($result['numbers'], $childValues['numbers']);
            $result['scalars'] = array_merge($result['scalars'], $childValues['scalars']);
        }
        return $result;
    }

    if (is_scalar($value)) {
        $text = trim((string) $value);
        if ($text !== '') {
            $result['scalars'][] = [
                'path' => $path,
                'value' => $value,
                'text' => $text,
            ];

            if (is_string($value)) {
                $result['strings'][] = $text;
            }

            if (is_int($value) || is_float($value)) {
                $result['numbers'][] = (float) $value;
            } elseif (is_string($value) && preg_match('/^-?\d+(?:[.,]\d+)?$/', str_replace(' ', '', $text))) {
                $amount = parse_payment_amount($text);
                if ($amount !== null) {
                    $result['numbers'][] = $amount;
                }
            }
        }
    }

    return $result;
}

function flatten_payload_strings($value): array
{
    return flatten_payload_values($value)['strings'];
}

function payload_value(array $payload, array $keys)
{
    $wanted = array_map('strtolower', $keys);

    foreach ($payload as $key => $value) {
        if (in_array(strtolower((string) $key), $wanted, true) && $value !== null && $value !== '') {
            return $value;
        }
    }

    foreach ($payload as $value) {
        if (is_array($value)) {
            $found = payload_value($value, $keys);
            if ($found !== null && $found !== '') {
                return $found;
            }
        }
    }

    return null;
}

function parse_payment_amount($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }

    if (!is_scalar($value)) {
        return null;
    }

    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }

    $normalized = preg_replace('/[^\d.,-]/', '', $text);
    if ($normalized === null || $normalized === '' || $normalized === '-' || $normalized === ',' || $normalized === '.') {
        return null;
    }

    $hasComma = strpos($normalized, ',') !== false;
    $hasDot = strpos($normalized, '.') !== false;

    if ($hasComma && $hasDot) {
        if (strrpos($normalized, ',') > strrpos($normalized, '.')) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } else {
            $normalized = str_replace(',', '', $normalized);
        }
    } elseif ($hasComma) {
        $normalized = preg_match('/,\d{1,2}$/', $normalized)
            ? str_replace(',', '.', $normalized)
            : str_replace(',', '', $normalized);
    } elseif ($hasDot && !preg_match('/\.\d{1,2}$/', $normalized)) {
        $normalized = str_replace('.', '', $normalized);
    }

    return is_numeric($normalized) ? (float) $normalized : null;
}

function parse_payment_amount_from_text(string $text): ?float
{
    $patterns = [
        '/(?:\+|amount|money|transferAmount|transactionAmount|so tien|tien vao)[^\d-]*(-?\d[\d.,]*)\s*(?:\x{0111}|vnd|vn\x{0111}|dong)?/iu',
        '/(-?\d[\d.,]*)\s*(?:\x{0111}|vnd|vn\x{0111}|dong)/iu',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match_all($pattern, $text, $matches)) {
            foreach ($matches[1] as $candidate) {
                $amount = parse_payment_amount($candidate);
                if ($amount !== null && $amount > 0) {
                    return $amount;
                }
            }
        }
    }

    return null;
}

function normalize_payment_payload(array $payload, string $rawBody): array
{
    $provider = (string) (app_config()['PAYMENT_PROVIDER'] ?? 'sepay');
    $eventId = payload_value($payload, [
        'event_id', 'eventId', 'id', 'transaction_id', 'transactionId', 'reference', 'referenceCode', 'payment_reference',
    ]);
    $reference = payload_value($payload, [
        'payment_reference', 'reference', 'referenceCode', 'transaction_id', 'transactionId', 'code', 'id',
    ]);
    $transferContent = payload_value($payload, [
        'content', 'description', 'transactionContent', 'transferContent', 'transaction_content',
        'transfer_content', 'addInfo', 'note', 'memo', 'message', 'order_code', 'orderCode',
    ]);
    $amount = payload_value($payload, [
        'amount', 'transferAmount', 'transactionAmount', 'money', 'value', 'amount_in',
        'transfer_amount', 'money_in', 'creditAmount', 'credit', 'transaction_amount',
    ]);

    if ($eventId === null || $eventId === '') {
        $eventId = hash('sha256', $rawBody !== '' ? $rawBody : json_encode($payload, JSON_UNESCAPED_SLASHES));
    }

    $flattened = flatten_payload_values($payload);
    $strings = $flattened['strings'];
    if ($rawBody !== '') {
        $strings[] = $rawBody;
    }

    if (($transferContent === null || $transferContent === '') && !empty($strings)) {
        foreach ($strings as $string) {
            if (preg_match('/\bFT[A-Z0-9]+\b/i', (string) $string)) {
                $transferContent = (string) $string;
                break;
            }
        }
    }

    $parsedAmount = parse_payment_amount($amount);
    if ($parsedAmount === null) {
        foreach ($strings as $string) {
            $parsedAmount = parse_payment_amount_from_text((string) $string);
            if ($parsedAmount !== null) {
                break;
            }
        }
    }

    return [
        'provider' => $provider,
        'event_id' => (string) $eventId,
        'reference' => $reference === null ? null : (string) $reference,
        'transfer_content' => $transferContent === null ? null : (string) $transferContent,
        'amount' => $parsedAmount,
        'all_strings' => array_values(array_unique($strings)),
        'all_numbers' => array_values(array_unique(array_filter($flattened['numbers'], static function ($value) {
            return is_numeric($value) && (float) $value > 0;
        }))),
    ];
}

function detect_payment_amount_for_order(array $event, array $order): ?float
{
    if ($event['amount'] !== null && (float) $event['amount'] > 0) {
        return (float) $event['amount'];
    }

    $orderAmount = (float) ($order['amount'] ?? 0);
    $numbers = array_values(array_filter($event['all_numbers'] ?? [], static function ($value) {
        return is_numeric($value) && (float) $value > 0;
    }));

    if (empty($numbers)) {
        return null;
    }

    usort($numbers, static function ($a, $b) use ($orderAmount) {
        $a = (float) $a;
        $b = (float) $b;
        $aEnough = $a + 0.01 >= $orderAmount;
        $bEnough = $b + 0.01 >= $orderAmount;

        if ($aEnough !== $bEnough) {
            return $aEnough ? -1 : 1;
        }

        if ($aEnough && $bEnough) {
            return $a <=> $b;
        }

        return $b <=> $a;
    });

    return (float) $numbers[0];
}

function record_payment_event(PDO $pdo, array $event, array $payload): array
{
    $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($payloadJson === false) {
        $payloadJson = json_encode(['payload_encode_error' => json_last_error_msg()], JSON_UNESCAPED_SLASHES);
    }

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO payment_events (provider, event_id, payload, processed, created_at)
         VALUES (?, ?, ?, 0, NOW())'
    );
    $stmt->execute([$event['provider'], $event['event_id'], $payloadJson]);

    $select = $pdo->prepare('SELECT * FROM payment_events WHERE provider = ? AND event_id = ? LIMIT 1');
    $select->execute([$event['provider'], $event['event_id']]);
    $row = $select->fetch();

    return $row ?: [];
}

function append_payment_event_debug(PDO $pdo, int $eventRowId, array $debug): void
{
    $stmt = $pdo->prepare('SELECT payload FROM payment_events WHERE id = ? LIMIT 1');
    $stmt->execute([$eventRowId]);
    $payload = json_decode((string) $stmt->fetchColumn(), true);
    if (!is_array($payload)) {
        $payload = [];
    }

    $payload['_processing_debug'] = array_merge($payload['_processing_debug'] ?? [], $debug);

    $update = $pdo->prepare('UPDATE payment_events SET payload = ? WHERE id = ?');
    $update->execute([json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), $eventRowId]);
}

function mark_payment_event_processed(PDO $pdo, int $eventRowId): void
{
    $stmt = $pdo->prepare('UPDATE payment_events SET processed = 1 WHERE id = ?');
    $stmt->execute([$eventRowId]);
}

function find_order_for_payment_event(PDO $pdo, array $event): ?array
{
    $stmt = $pdo->prepare(
        'SELECT * FROM orders
         WHERE status = "pending"
         AND created_at >= ?
         ORDER BY id DESC
         LIMIT 500'
    );
    $stmt->execute([cutoff_datetime(72)]);
    $orders = $stmt->fetchAll();

    $haystacks = $event['all_strings'] ?? [];
    if (!empty($event['transfer_content'])) {
        $haystacks[] = (string) $event['transfer_content'];
    }

    $haystacks = array_map(static function ($value) {
        return strtoupper((string) $value);
    }, $haystacks);

    foreach ($orders as $order) {
        $needle = strtoupper(trim((string) $order['transfer_content']));
        if ($needle === '') {
            continue;
        }

        foreach ($haystacks as $text) {
            if ($text !== '' && strpos($text, $needle) !== false) {
                return $order;
            }
        }
    }

    return null;
}

function lock_order_by_id(PDO $pdo, int $orderId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? FOR UPDATE');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    return $order ?: null;
}

function store_order_worker_error(PDO $pdo, int $orderId, Throwable $e): void
{
    $payload = [
        'ok' => false,
        'error' => 'worker_key_generation_failed',
        'message' => $e->getMessage(),
        'time' => date('c'),
    ];

    $stmt = $pdo->prepare('UPDATE orders SET worker_response = ? WHERE id = ?');
    $stmt->execute([json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $orderId]);
}

function generate_key_for_paid_order(PDO $pdo, array $order): array
{
    if (!empty($order['generated_key'])) {
        return $order;
    }

    $plan = get_plan((string) $order['plan_code']);
    if (!$plan) {
        throw new RuntimeException('Order plan is not configured.');
    }

    try {
        $created = worker_create_key(
            'vip',
            (string) $order['duration'],
            1,
            'premium order ' . (string) $order['public_id']
        );
    } catch (Throwable $e) {
        store_order_worker_error($pdo, (int) $order['id'], $e);
        throw $e;
    }

    $stmt = $pdo->prepare(
        'UPDATE orders
         SET generated_key = ?, worker_response = ?, key_generated_at = NOW()
         WHERE id = ? AND generated_key IS NULL'
    );
    $stmt->execute([
        $created['key'],
        json_encode($created['response'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        (int) $order['id'],
    ]);

    $order['generated_key'] = $created['key'];
    $order['worker_response'] = json_encode($created['response'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $order['key_generated_at'] = date('Y-m-d H:i:s');

    return $order;
}

function apply_payment_to_order(PDO $pdo, array $order, array $event): array
{
    $locked = lock_order_by_id($pdo, (int) $order['id']);
    if (!$locked) {
        throw new RuntimeException('Order not found.');
    }

    $expireHours = (int) (app_config()['ORDER_EXPIRE_HOURS'] ?? 24);
    if (($locked['status'] ?? '') === 'pending' && (string) $locked['created_at'] < cutoff_datetime($expireHours)) {
        $stmt = $pdo->prepare('UPDATE orders SET status = "expired" WHERE id = ? AND status = "pending"');
        $stmt->execute([(int) $locked['id']]);
        $locked['status'] = 'expired';
        return $locked;
    }

    if (($locked['status'] ?? '') === 'expired' || ($locked['status'] ?? '') === 'failed') {
        return $locked;
    }

    if ($event['amount'] === null) {
        $event['amount'] = detect_payment_amount_for_order($event, $locked);
    }

    if ($event['amount'] === null) {
        throw new RuntimeException('Payment amount was not found in webhook payload.');
    }

    if ((float) $event['amount'] + 0.01 < (float) $locked['amount']) {
        throw new RuntimeException('Payment amount is lower than the order amount.');
    }

    if (($locked['status'] ?? '') === 'pending') {
        $stmt = $pdo->prepare(
            'UPDATE orders
             SET status = "paid", payment_provider = ?, payment_reference = ?, paid_at = NOW()
             WHERE id = ? AND status = "pending"'
        );
        $stmt->execute([
            $event['provider'],
            $event['reference'],
            (int) $locked['id'],
        ]);

        $locked['status'] = 'paid';
        $locked['payment_provider'] = $event['provider'];
        $locked['payment_reference'] = $event['reference'];
        $locked['paid_at'] = date('Y-m-d H:i:s');
    }

    return $locked;
}

function complete_order_payment(PDO $pdo, array $order, array $event): array
{
    $updated = apply_payment_to_order($pdo, $order, $event);

    if (($updated['status'] ?? '') === 'paid') {
        return generate_key_for_paid_order($pdo, $updated);
    }

    return $updated;
}
