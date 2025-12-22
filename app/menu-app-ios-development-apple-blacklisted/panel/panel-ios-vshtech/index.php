<?php
require __DIR__ . '/time.php';

$htmlPath = __DIR__ . '/index.html';
if (!is_file($htmlPath)) {
  http_response_code(404);
  exit('index.html not found');
}

$cssVer = asset_ver('color/theme.css');
$jsVer  = asset_ver('keygate.js');

$html = file_get_contents($htmlPath);

$search = [
  './color/theme.css',
  './keygate.js',
];

$replace = [
  "./color/theme.css?v={$cssVer}",
  "./keygate.js?v={$jsVer}",
];

echo str_replace($search, $replace, $html);
