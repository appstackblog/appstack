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
$searchIconVer = asset_ver('img/kinhlup.svg');

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

$html = str_replace($search, $replace, $html);

// Override search icon with versioned SVG
$html = str_replace(
  '</head>',
  "<style>.search-icon{background:url(\"img/kinhlup.svg?v={$searchIconVer}\") center/contain no-repeat;}</style></head>",
  $html
);

echo $html;
