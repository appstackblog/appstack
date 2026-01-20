<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('uchiha.css');
$jsVer  = asset_ver('uchiha.js');
$panelVer = asset_ver('../assets/icons/panel.png');

$html = file_get_contents(__DIR__ . '/index.html');
$search = [
  'uchiha.css',
  'uchiha.js',
  '../assets/icons/panel.png',
  '../index.html'
];
$replace = [
  'uchiha.css?v=' . $cssVer,
  'uchiha.js?v=' . $jsVer,
  '../assets/icons/panel.png?v=' . $panelVer,
  '../index.php'
];

echo str_replace($search, $replace, $html);
