<?php
$id = $_GET['id'] ?? '';

$maps = [
    'fat_bank'        => __DIR__ . '/plist-fat/Bank.plist',
    'fat_chiba'       => __DIR__ . '/plist-fat/Chiba.plist',
    'fat_chinatelecom'=> __DIR__ . '/plist-fat/ChinaTelecom.plist',
    'fat_education'   => __DIR__ . '/plist-fat/Education.plist',
    'fat_eeo'         => __DIR__ . '/plist-fat/Eeo.plist',
    'fat_eryuan'      => __DIR__ . '/plist-fat/Eryuan.plist',
    'fat_esen'        => __DIR__ . '/plist-fat/Esen.plist',
    'fat_infor'       => __DIR__ . '/plist-fat/Infor.plist',
    'fat_mkt'         => __DIR__ . '/plist-fat/Mkt.plist',
    'fat_takeoff'     => __DIR__ . '/plist-fat/Takeoff.plist',
    'fat_telecom'     => __DIR__ . '/plist-fat/Telecom.plist',
    'fat_tianjin'     => __DIR__ . '/plist-fat/Tianjin.plist',
    'fat_truck'       => __DIR__ . '/plist-fat/Truck.plist',
    'fat_viettel'     => __DIR__ . '/plist-fat/Viettel.plist',
    'fat_viettinbank' => __DIR__ . '/plist-fat/Viettinbank.plist',
    'fat_wuling'      => __DIR__ . '/plist-fat/Wuling.plist',
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
