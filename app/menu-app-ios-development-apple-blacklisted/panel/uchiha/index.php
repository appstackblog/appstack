<?php
require __DIR__ . '/time.php';

$htmlPath = __DIR__ . '/index.html';
if (!is_file($htmlPath)) {
  http_response_code(404);
  exit('index.html not found');
}

$cssVer = asset_ver('styles.css');
$appVer = asset_ver('app.js');
$keyVer = asset_ver('key.js');

$html = file_get_contents($htmlPath);

$search = [
  'styles.css',
  'app.js',
  'key.js',
];

$replace = [
  "styles.css?v={$cssVer}",
  "app.js?v={$appVer}",
  "key.js?v={$keyVer}",
];

$html = str_replace($search, $replace, $html);

echo $html;
