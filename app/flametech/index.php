<?php
require __DIR__ . '/time.php';

$cssVer   = asset_ver('falcon.css');
$jsVer    = asset_ver('falcon.js');
$flameVer = asset_ver('../assets/icons/flt.jpg');
$panelVer = asset_ver('../assets/icons/panel.png');
$dnsVer   = asset_ver('../assets/dns.png');
$avatarVer = asset_ver('../assets/avatar.png');

$html = file_get_contents(__DIR__ . '/index.html');

$search = [
  './falcon.css',
  './falcon.js',
  '../assets/icons/flt.jpg',
  '../assets/icons/panel.png',
  '../assets/dns.png',
  '../index.html',
  '../assets/avatar.png',
];

$replace = [
  './falcon.css?v=' . $cssVer,
  './falcon.js?v=' . $jsVer,
  '../assets/icons/flt.jpg?v=' . $flameVer,
  '../assets/icons/panel.png?v=' . $panelVer,
  '../assets/dns.png?v=' . $dnsVer,
  '../index.php',
  '../assets/avatar.png?v=' . $avatarVer,
];

echo str_replace($search, $replace, $html);
