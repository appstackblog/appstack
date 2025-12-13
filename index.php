<?php
require __DIR__ . '/time.php';

// Ưu tiên phục vụ main.html nếu có
$main = __DIR__ . '/main.html';
if (is_file($main)) {
    readfile($main);
    exit;
}

$cssVer  = asset_ver('quasar-veil.css');
$jsVer   = asset_ver('orbit-wisp.js');
$logoVer = asset_ver('img/hehe.gif');

$html = file_get_contents(__DIR__ . '/index.html');

$search = [
  'quasar-veil.css',
  'orbit-wisp.js',
  'img/hehe.gif'
];

$replace = [
  'quasar-veil.css?v=' . $cssVer,
  'orbit-wisp.js?v=' . $jsVer,
  'img/hehe.gif?v=' . $logoVer
];

echo str_replace($search, $replace, $html);
