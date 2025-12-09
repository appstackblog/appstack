<?php
// Serve index.html when present; otherwise fallback to blog entry point to avoid directory listing
$htmlPath = __DIR__ . '/index.html';
$blogIndex = __DIR__ . '/blog/index.php';

if (is_file($htmlPath)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($htmlPath);
    exit;
}

if (is_file($blogIndex)) {
    header('Location: /blog/index.php', true, 302);
    exit;
}

http_response_code(404);
echo 'Not found';
