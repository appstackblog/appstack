<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('styles.css');
$jsVer = asset_ver('script.js');

$html = file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
  http_response_code(500);
  exit('Cannot read index.html');
}

$search = [
  './styles.css',
  './script.js',
];

$replace = [
  './styles.css?v=' . $cssVer,
  './script.js?v=' . $jsVer,
];

echo str_replace($search, $replace, $html);
