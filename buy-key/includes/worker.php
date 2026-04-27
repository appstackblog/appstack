<?php

declare(strict_types=1);

require_once __DIR__ . '/functions.php';

function worker_http_request(string $method, string $path, ?array $payload = null, bool $admin = false): array
{
    $config = app_config();
    $baseUrl = rtrim((string) ($config['WORKER_BASE_URL'] ?? ''), '/');

    if ($baseUrl === '') {
        throw new RuntimeException('WORKER_BASE_URL is not configured.');
    }

    $url = preg_match('#^https?://#i', $path) ? $path : $baseUrl . '/' . ltrim($path, '/');
    $body = $payload === null ? null : json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload !== null && $body === false) {
        throw new RuntimeException('Could not encode Worker request body.');
    }

    $headers = ['Accept: application/json'];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    if ($admin) {
        $serverKey = trim((string) ($config['WORKER_ADMIN_KEY'] ?? ''));
        if ($serverKey === '' || stripos($serverKey, 'change-me') !== false || stripos($serverKey, 'DAN_WORKER_ADMIN_KEY') !== false) {
            throw new RuntimeException('WORKER_ADMIN_KEY is not configured. Replace the placeholder in config/config.php.');
        }
        $headers[] = 'x-server-key: ' . $serverKey;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 25,
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $responseBody = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false) {
            throw new RuntimeException('Worker request failed: ' . $error);
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => strtoupper($method),
                'header' => implode("\r\n", $headers),
                'content' => $body ?? '',
                'timeout' => 25,
                'ignore_errors' => true,
            ],
        ]);

        $responseBody = file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
            $status = (int) $matches[1];
        }

        if ($responseBody === false) {
            throw new RuntimeException('Worker request failed.');
        }
    }

    $decoded = json_decode((string) $responseBody, true);
    $data = is_array($decoded) ? $decoded : ['raw' => (string) $responseBody];

    if ($status < 200 || $status >= 300) {
        $message = isset($data['message']) ? (string) $data['message'] : 'Worker returned HTTP ' . $status;
        throw new RuntimeException($message . '. Raw response: ' . substr((string) $responseBody, 0, 1000));
    }

    return [
        'status' => $status,
        'body' => $data,
        'raw' => (string) $responseBody,
    ];
}

function worker_create_key(string $tier, string $duration, int $quantity, string $note): array
{
    if (!in_array($tier, ['free', 'vip'], true)) {
        throw new InvalidArgumentException('Invalid Worker key tier.');
    }

    if (!preg_match('/^\d+d$/', $duration)) {
        throw new InvalidArgumentException('Invalid key duration.');
    }

    if ($quantity < 1 || $quantity > 100) {
        throw new InvalidArgumentException('Invalid key quantity.');
    }

    $response = worker_http_request('POST', '/api/keys', [
        'tier' => $tier,
        'duration' => $duration,
        'quantity' => $quantity,
        'note' => $note,
    ], true);

    $body = $response['body'];
    $key = $body['keys'][0]['key']
        ?? $body['key']
        ?? $body['license_key']
        ?? $body['data']['key']
        ?? $body['data']['keys'][0]['key']
        ?? null;

    $success = !empty($body['ok']) || !empty($body['success']) || is_string($key);

    if (!$success || !is_string($key) || trim($key) === '') {
        throw new RuntimeException('Worker did not return a generated key. Raw response: ' . substr($response['raw'], 0, 1000));
    }

    return [
        'key' => trim($key),
        'response' => $body,
    ];
}

function worker_check_key(string $key): array
{
    $key = trim($key);
    if ($key === '' || strlen($key) > 255) {
        throw new InvalidArgumentException('Enter a valid license key.');
    }

    $config = app_config();
    $path = (string) ($config['WORKER_VERIFY_PATH'] ?? '/api/keys/verify');
    if ($path === '') {
        return [
            'ok' => false,
            'message' => 'Key verification endpoint is not configured.',
        ];
    }

    $requiresAdmin = !empty($config['WORKER_VERIFY_REQUIRES_ADMIN_KEY']);
    $response = worker_http_request('POST', $path, ['key' => $key], $requiresAdmin);

    return $response['body'];
}

