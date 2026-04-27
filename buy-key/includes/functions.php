<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', '', $secure, true);
    }
    session_start();
}

function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function site_url(string $path = ''): string
{
    $base = rtrim((string) (app_config()['SITE_URL'] ?? ''), '/');
    if ($base === '' || stripos($base, 'your-domain.com') !== false) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base = $scheme . '://' . $host;
    }
    $path = '/' . ltrim($path, '/');
    return $base . ($path === '/' ? '' : $path);
}

function internal_url(string $path = ''): string
{
    $path = '/' . ltrim($path, '/');
    return $path === '/' ? '/' : $path;
}

function asset_url(string $path): string
{
    $path = ltrim($path, '/');
    $url = '/assets/' . str_replace('\\', '/', $path);
    $file = dirname(__DIR__) . '/assets/' . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);

    if (is_file($file)) {
        $separator = strpos($url, '?') === false ? '?' : '&';
        return $url . $separator . 'v=' . filemtime($file);
    }

    return $url;
}

function redirect(string $url): void
{
    header('Location: ' . $url, true, 302);
    exit;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    return stripos($accept, 'application/json') !== false || stripos($contentType, 'application/json') !== false;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_response(['ok' => false, 'message' => 'Phương thức yêu cầu không được hỗ trợ.'], 405);
    }
}

function normalize_email(string $email): string
{
    return strtolower(trim($email));
}

function valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 255;
}

function client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? '',
    ];

    foreach ($candidates as $candidate) {
        $candidate = trim(explode(',', $candidate)[0]);
        if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_IP)) {
            return $candidate;
        }
    }

    return 'unknown';
}

function random_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

function random_code(int $length = 8): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    $max = strlen($alphabet) - 1;

    for ($i = 0; $i < $length; $i++) {
        $code .= $alphabet[random_int(0, $max)];
    }

    return $code;
}

function app_plans(): array
{
    return app_config()['PLANS'] ?? [];
}

function get_plan(string $planCode): ?array
{
    $plans = app_plans();
    if (!isset($plans[$planCode])) {
        return null;
    }

    $plan = $plans[$planCode];
    $plan['code'] = $planCode;
    return $plan;
}

function plan_label(string $planCode): string
{
    $plan = get_plan($planCode);
    return $plan['name'] ?? $planCode;
}

function format_money($amount, string $currency = 'VND'): string
{
    $decimals = strtoupper($currency) === 'VND' ? 0 : 2;
    return number_format((float) $amount, $decimals) . ' ' . strtoupper($currency);
}

function cutoff_datetime(int $hours): string
{
    return (new DateTimeImmutable('-' . max(1, $hours) . ' hours'))->format('Y-m-d H:i:s');
}

function create_unique_transfer_content(PDO $pdo): string
{
    do {
        $code = 'FT' . date('ymd') . random_code(6);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE transfer_content = ?');
        $stmt->execute([$code]);
    } while ((int) $stmt->fetchColumn() > 0);

    return $code;
}

function create_order(PDO $pdo, string $email, string $planCode): array
{
    $plan = get_plan($planCode);
    if (!$plan) {
        throw new InvalidArgumentException('Gói Premium đã chọn không hợp lệ.');
    }

    $publicId = random_token(16);
    $transferContent = create_unique_transfer_content($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO orders (public_id, email, plan_code, duration, amount, currency, status, transfer_content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, "pending", ?, NOW())'
    );
    $stmt->execute([
        $publicId,
        $email,
        $planCode,
        $plan['duration'],
        $plan['amount'],
        $plan['currency'] ?? 'VND',
        $transferContent,
    ]);

    return find_order_by_public_id($pdo, $publicId);
}

function expire_order_if_needed(PDO $pdo, array $order): array
{
    if (($order['status'] ?? '') !== 'pending') {
        return $order;
    }

    $hours = (int) (app_config()['ORDER_EXPIRE_HOURS'] ?? 24);
    $cutoff = cutoff_datetime($hours);

    $stmt = $pdo->prepare('UPDATE orders SET status = "expired" WHERE id = ? AND status = "pending" AND created_at < ?');
    $stmt->execute([(int) $order['id'], $cutoff]);

    if ($stmt->rowCount() > 0) {
        $order['status'] = 'expired';
    }

    return $order;
}

function find_order_by_public_id(PDO $pdo, string $publicId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE public_id = ? LIMIT 1');
    $stmt->execute([$publicId]);
    $order = $stmt->fetch();

    return $order ? expire_order_if_needed($pdo, $order) : null;
}

function find_free_claim_by_public_id(PDO $pdo, string $publicId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM free_claims WHERE public_id = ? LIMIT 1');
    $stmt->execute([$publicId]);
    $claim = $stmt->fetch();

    return $claim ?: null;
}

function status_badge_class(string $status): string
{
    switch ($status) {
        case 'paid':
        case 'completed':
            return 'badge badge-success';
        case 'failed':
        case 'expired':
            return 'badge badge-danger';
        case 'used':
            return 'badge badge-muted';
        default:
            return 'badge badge-warning';
    }
}

function status_label(string $status, string $context = 'order'): string
{
    $orderLabels = [
        'pending' => 'Đang chờ thanh toán',
        'paid' => 'Đã thanh toán',
        'failed' => 'Thất bại',
        'expired' => 'Đã hết hạn',
    ];

    $claimLabels = [
        'pending' => 'Đang chờ xác minh',
        'completed' => 'Hoàn tất',
        'used' => 'Đã sử dụng',
        'expired' => 'Đã hết hạn',
        'failed' => 'Thất bại',
    ];

    $labels = $context === 'claim' ? $claimLabels : $orderLabels;
    return $labels[$status] ?? $status;
}

function key_status_label(string $status): string
{
    $labels = [
        'active' => 'Đang hoạt động',
        'valid' => 'Hợp lệ',
        'inactive' => 'Chưa kích hoạt',
        'expired' => 'Đã hết hạn',
        'revoked' => 'Đã thu hồi',
        'blocked' => 'Đã bị khóa',
        'invalid' => 'Không hợp lệ',
        'used' => 'Đã sử dụng',
    ];

    $normalized = strtolower(trim($status));
    return $labels[$normalized] ?? $status;
}

function bank_qr_url(array $order): string
{
    $config = app_config();
    $bin = trim((string) ($config['BANK_BIN'] ?? ''));
    $account = preg_replace('/\D+/', '', (string) ($config['BANK_ACCOUNT_NUMBER'] ?? ''));

    if ($bin === '' || $account === '') {
        return '';
    }

    $query = http_build_query([
        'amount' => (int) round((float) $order['amount']),
        'addInfo' => $order['transfer_content'],
        'accountName' => $config['BANK_ACCOUNT_NAME'] ?? '',
    ]);

    return 'https://img.vietqr.io/image/' . rawurlencode($bin) . '-' . rawurlencode($account) . '-compact2.png?' . $query;
}

function build_free_link_url(string $token): string
{
    $config = app_config();
    $secret = (string) ($config['FREE_LINK_SECRET'] ?? '');
    $callbackParams = ['token' => $token];

    if ($secret !== '' && stripos($secret, 'change-me') === false) {
        $callbackParams['sig'] = hash_hmac('sha256', $token, $secret);
    }

    $callback = site_url('/api/free-callback.php?' . http_build_query($callbackParams));
    $base = trim((string) ($config['FREE_LINK_BASE_URL'] ?? ''));

    if ($base === '' || stripos($base, 'link-provider.example') !== false) {
        return $callback;
    }

    if (strpos($base, '{callback}') !== false || strpos($base, '{token}') !== false) {
        return str_replace(
            ['{callback}', '{token}'],
            [rawurlencode($callback), rawurlencode($token)],
            $base
        );
    }

    $separator = strpos($base, '?') === false ? '?' : '&';
    return $base . $separator . http_build_query(['callback' => $callback, 'token' => $token]);
}

function verify_free_callback_token(string $token): bool
{
    start_secure_session();

    $secret = (string) (app_config()['FREE_LINK_SECRET'] ?? '');
    $sig = (string) ($_GET['sig'] ?? '');

    if ($secret !== '' && stripos($secret, 'change-me') === false && $sig !== '') {
        return hash_equals(hash_hmac('sha256', $token, $secret), $sig);
    }

    return isset($_SESSION['free_claim_token']) && hash_equals((string) $_SESSION['free_claim_token'], $token);
}

function free_claim_rate_limited(PDO $pdo, string $email, string $ip, int $excludeId = 0): bool
{
    $hours = (int) (app_config()['FREE_RATE_LIMIT_HOURS'] ?? 24);
    $cutoff = cutoff_datetime($hours);

    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM free_claims
         WHERE (email = ? OR ip_address = ?)
         AND created_at >= ?
         AND status IN ("pending", "completed", "used")
         AND id <> ?'
    );
    $stmt->execute([$email, $ip, $cutoff, $excludeId]);

    return (int) $stmt->fetchColumn() > 0;
}

function app_error_message(Throwable $e): string
{
    if (app_debug_enabled()) {
        return $e->getMessage();
    }

    if ($e instanceof InvalidArgumentException || $e instanceof AppUserFacingException) {
        return $e->getMessage();
    }

    return 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.';

    return 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
}
