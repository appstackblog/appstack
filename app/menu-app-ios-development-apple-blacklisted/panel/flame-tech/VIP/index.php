<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('style.css');
$keyVer = asset_ver('key.js');
$jsVer = asset_ver('script.js');

$html = file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
  http_response_code(500);
  exit('Cannot read index.html');
}

$search = [
  'href="style.css"',
  'src="key.js"',
  'src="script.js"',
  "../index.html",
];

$replace = [
  'href="style.css?v=' . $cssVer . '"',
  'src="key.js?v=' . $keyVer . '"',
  'src="script.js?v=' . $jsVer . '"',
  '../index.php',
];

echo str_replace($search, $replace, $html);
