<?php
$id = $_GET['id'] ?? '';

$links = [
    'zalo' => 'https://zalo.me/0937161512',
    'telegram' => 'https://t.me/Fatx007',
    'facebook' => 'https://www.facebook.com/phat.tien.697911',
];

if (!isset($links[$id])) {
    http_response_code(404);
    exit('Not found');
}

header('Location: ' . $links[$id]);
exit;
