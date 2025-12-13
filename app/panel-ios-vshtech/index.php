<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('lumina.css');
$jsVer  = asset_ver('lumina.js');
$panelVer = asset_ver('../assets/icons/panel.png');

$html = file_get_contents(__DIR__ . '/index.html');
$search = [
  'lumina.css',
  'lumina.js',
  '../assets/icons/panel.png',
  '../index.html'
];
$replace = [
  'lumina.css?v=' . $cssVer,
  'lumina.js?v=' . $jsVer,
  '../assets/icons/panel.png?v=' . $panelVer,
  '../index.php'
];

echo str_replace($search, $replace, $html);
