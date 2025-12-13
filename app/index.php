<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('mainstyle.css');
$jsVer  = asset_ver('mainscript.js');
$avatarVer = asset_ver('assets/avatar.png');
$panelIconVer = asset_ver('assets/icons/panel.png');
$fatIconVer = asset_ver('assets/icons/fat.png');
$dnsIconVer = asset_ver('assets/dns.png');

$html = file_get_contents(__DIR__ . '/index.html');

$search = [
  'mainstyle.css',
  'mainscript.js',
  'assets/avatar.png',
  'assets/icons/panel.png',
  'assets/icons/fat.png',
  'assets/dns.png'
];

$replace = [
  'mainstyle.css?v=' . $cssVer,
  'mainscript.js?v=' . $jsVer,
  'assets/avatar.png?v=' . $avatarVer,
  'assets/icons/panel.png?v=' . $panelIconVer,
  'assets/icons/fat.png?v=' . $fatIconVer,
  'assets/dns.png?v=' . $dnsIconVer
];

echo str_replace($search, $replace, $html);
