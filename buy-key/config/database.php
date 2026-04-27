<?php

declare(strict_types=1);

class AppUserFacingException extends RuntimeException
{
}

function app_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) {
        throw new RuntimeException('Thiếu file cấu hình config/config.php.');
    }

    $config = require $configFile;
    if (!is_array($config)) {
        throw new RuntimeException('File cấu hình config/config.php phải trả về một mảng hợp lệ.');
    }

    configure_runtime_errors($config);

    return $config;
}

function configure_runtime_errors(array $config): void
{
    static $configured = false;

    if ($configured) {
        return;
    }

    $debug = !empty($config['APP_DEBUG']);

    if ($debug) {
        error_reporting(E_ALL);
        ini_set('display_errors', '1');
        ini_set('display_startup_errors', '1');
    } else {
        error_reporting(E_ALL);
        ini_set('display_errors', '0');
        ini_set('display_startup_errors', '0');
        ini_set('log_errors', '1');
    }

    $configured = true;
}

function app_debug_enabled(): bool
{
    try {
        return !empty(app_config()['APP_DEBUG']);
    } catch (Throwable $e) {
        return false;
    }
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_config();
    $host = trim((string) ($config['DB_HOST'] ?? ''));
    $name = trim((string) ($config['DB_NAME'] ?? ''));
    $user = (string) ($config['DB_USER'] ?? '');
    $pass = (string) ($config['DB_PASS'] ?? '');

    if ($host === '' || $name === '' || $user === '') {
        throw new AppUserFacingException('Chưa cấu hình đầy đủ thông tin database trong config/config.php.');
    }

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $host, $name);

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        if (app_debug_enabled()) {
            throw new RuntimeException('Không thể kết nối database: ' . $e->getMessage(), 0, $e);
        }

        throw new AppUserFacingException('Không thể kết nối hệ thống. Vui lòng thử lại sau.', 0, $e);
    }

    return $pdo;
}

