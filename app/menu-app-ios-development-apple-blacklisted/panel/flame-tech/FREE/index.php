<?php
require __DIR__ . '/time.php';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$entry = strtolower((string) ($_GET['entry'] ?? ''));

if (stripos(str_replace('\\', '/', $requestPath), '/FREE/') === false || $entry !== 'hub') {
  header('Location: ../index.html', true, 302);
  exit;
}

$cssVer = asset_ver('style.css');
$keyVer = asset_ver('key.js');
$jsVer = asset_ver('script.js');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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
