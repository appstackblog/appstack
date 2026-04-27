<?php
$host = 'localhost';
$db   = 'appstack_buykey';
$user = 'appstack_buykeyuser';
$pass = '!Hdchu2006!';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    echo "✅ Kết nối database thành công!";
} catch (Throwable $e) {
    echo "❌ Lỗi kết nối database:<br>";
    echo htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
}
