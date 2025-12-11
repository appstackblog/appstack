<?php
$id = $_GET['id'] ?? '';

$maps = [
    'fat_chiba'          => __DIR__ . '/plist-fat/fat_chiba.plist',
    'fat_chinatelecom'   => __DIR__ . '/plist-fat/fat_chinatelecom.plist',
    'fat_education'      => __DIR__ . '/plist-fat/fat_education.plist',
    'fat_Eryuan'         => __DIR__ . '/plist-fat/fat_Eryuan.plist',
    'fat_takeoff'        => __DIR__ . '/plist-fat/fat_takeoff.plist',
    'fat_Tianjin'        => __DIR__ . '/plist-fat/fat_Tianjin.plist',
    'fat_truck'          => __DIR__ . '/plist-fat/fat_truck.plist',
    'fat_vietnambank'    => __DIR__ . '/plist-fat/fat_vietnambank.plist',
    'fat_wuling'         => __DIR__ . '/plist-fat/fat_wuling.plist',
    'fat_chinamobile'    => __DIR__ . '/plist-fat/fat_chinamobile.plist',
    'fat_bocom'          => __DIR__ . '/plist-fat/fat_bocom.plist',
    'fat_icbc'           => __DIR__ . '/plist-fat/fat_icbc.plist',
    'fat_cspg'           => __DIR__ . '/plist-fat/fat_cspg.plist',
    'fat_ccb'            => __DIR__ . '/plist-fat/fat_ccb.plist',
    'fat_boc'            => __DIR__ . '/plist-fat/fat_boc.plist',
    'fat_sjtu'           => __DIR__ . '/plist-fat/fat_sjtu.plist',
];

if (!isset($maps[$id])) {
    http_response_code(404);
    exit('Not found');
}

$target = $maps[$id];
if (!is_file($target)) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: application/xml');
header('Content-Disposition: inline; filename="' . basename($target) . '"');
readfile($target);
exit;
