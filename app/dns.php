<?php
// Redirect DNS config download by id to hide direct URL
$id = $_GET['id'] ?? '';

$maps = [
    'cloudflare' => __DIR__ . '/assets/dns/cloudflare-dns-vshtech.mobileconfig',
];

if (!isset($maps[$id])) {
    http_response_code(404);
    exit('Not found');
}

$file = $maps[$id];
if (!is_file($file)) {
    http_response_code(404);
    exit('Not found');
}

// Build absolute URL
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '';
$path = str_replace(__DIR__, '', $file);
$url = $host ? "{$scheme}://{$host}/app{$path}" : null;

if ($url) {
    header('Cache-Control: no-store');
    header('Location: ' . $url, true, 302);
    exit;
}

// Fallback: serve file directly
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($file) . '"');
header('Cache-Control: no-store');
readfile($file);
exit;
