<?php
require __DIR__ . '/time.php';

$htmlPath = __DIR__ . '/index.html';
if (!is_file($htmlPath)) {
  http_response_code(404);
  exit('index.html not found');
}

$cssVer = asset_ver('color/theme.css');
$jsVer  = asset_ver('keygate.js');
$aimlockVer = asset_ver('java/aimlock.js');
$anchorAimVer = asset_ver('java/anchorAim.js');
$appVer = asset_ver('java/app.js');
$driftFixVer = asset_ver('java/driftFix.js');
$featherAimVer = asset_ver('java/featherAim.js');
$headFixVer = asset_ver('java/headFix.js');
$quickSwipeVer = asset_ver('java/quickSwipe.js');
$screenBoostVer = asset_ver('java/screenBoost.js');
$shakeFixVer = asset_ver('java/shakeFix.js');
$steadyHoldVer = asset_ver('java/steadyHold.js');

$html = file_get_contents($htmlPath);

$search = [
  './color/theme.css',
  './keygate.js',
  './java/aimlock.js',
  './java/anchorAim.js',
  './java/app.js',
  './java/driftFix.js',
  './java/featherAim.js',
  './java/headFix.js',
  './java/quickSwipe.js',
  './java/screenBoost.js',
  './java/shakeFix.js',
  './java/steadyHold.js',
];

$replace = [
  "./color/theme.css?v={$cssVer}",
  "./keygate.js?v={$jsVer}",
  "./java/aimlock.js?v={$aimlockVer}",
  "./java/anchorAim.js?v={$anchorAimVer}",
  "./java/app.js?v={$appVer}",
  "./java/driftFix.js?v={$driftFixVer}",
  "./java/featherAim.js?v={$featherAimVer}",
  "./java/headFix.js?v={$headFixVer}",
  "./java/quickSwipe.js?v={$quickSwipeVer}",
  "./java/screenBoost.js?v={$screenBoostVer}",
  "./java/shakeFix.js?v={$shakeFixVer}",
  "./java/steadyHold.js?v={$steadyHoldVer}",
];

echo str_replace($search, $replace, $html);
