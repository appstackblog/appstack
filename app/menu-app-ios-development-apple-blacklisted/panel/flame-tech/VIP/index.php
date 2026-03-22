<?php
require __DIR__ . '/time.php';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$entry = strtolower((string) ($_GET['entry'] ?? ''));

if (stripos(str_replace('\\', '/', $requestPath), '/VIP/') === false || $entry !== 'hub') {
  header('Location: ../index.html', true, 302);
  exit;
}

$cssVer = asset_ver('style.css');
$keyVer = asset_ver('key.js');
$jsVer = asset_ver('script.js');
$funcVer = asset_ver('func-engine.js');
$logoVer = asset_ver('img/flt.png');
$featureModules = [
  'aimlock.js',
  'stability assist.js',
  'aim hold.js',
  'aim lockdown.js',
  'sensitivity boost.js',
  'screen boost.js',
  'headshot fix.js',
  'bulletalign.js',
  'shake fix.js',
];
$featureModuleVers = [];
foreach ($featureModules as $featureModule) {
  $featureModuleVers[$featureModule] = asset_ver('C#/' . $featureModule);
}
$featureModuleJson = json_encode(
  $featureModuleVers,
  JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);

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
  'src="img/flt.png"',
  '<script src="func-engine.js"></script>',
  "../index.html",
];

$replace = [
  'href="style.css?v=' . $cssVer . '"',
  'src="key.js?v=' . $keyVer . '"',
  'src="script.js?v=' . $jsVer . '"',
  'src="img/flt.png?v=' . $logoVer . '"',
  '<script>window.ftFeatureModuleVersions=' . $featureModuleJson . ';</script>' . "\n" . '<script src="func-engine.js?v=' . $funcVer . '"></script>',
  '../index.php',
];

echo str_replace($search, $replace, $html);
