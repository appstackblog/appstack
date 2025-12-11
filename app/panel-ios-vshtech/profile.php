<?php
$id = $_GET['id'] ?? '';

$links = [
    'zalo' => 'https://zalo.me/0382304188',
    'telegram' => 'https://t.me/cskh_vshtech',
    'facebook' => 'https://www.facebook.com/share/17SQxwU6id/?mibextid=wwXIfr',
];

if (!isset($links[$id])) {
    http_response_code(404);
    exit('Not found');
}

header('Location: ' . $links[$id]);
exit;
