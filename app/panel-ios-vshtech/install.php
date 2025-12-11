<?php
$id = $_GET['id'] ?? '';

$maps = [
    'panel_bank'        => __DIR__ . '/plist/Bank.plist',
    'panel_chiba'       => __DIR__ . '/plist/Chiba.plist',
    'panel_chinatelecom'=> __DIR__ . '/plist/ChinaTelecom.plist',
    'panel_education'   => __DIR__ . '/plist/Education.plist',
    'panel_eeo'         => __DIR__ . '/plist/Eeo.plist',
    'panel_eryuan'      => __DIR__ . '/plist/Eryuan.plist',
    'panel_esen'        => __DIR__ . '/plist/Esen.plist',
    'panel_infor'       => __DIR__ . '/plist/Infor.plist',
    'panel_mkt'         => __DIR__ . '/plist/Mkt.plist',
    'panel_takeoff'     => __DIR__ . '/plist/Takeoff.plist',
    'panel_telecom'     => __DIR__ . '/plist/Telecom.plist',
    'panel_tianjin'     => __DIR__ . '/plist/Tianjin.plist',
    'panel_truck'       => __DIR__ . '/plist/Truck.plist',
    'panel_viettel'     => __DIR__ . '/plist/Viettel.plist',
    'panel_viettinbank' => __DIR__ . '/plist/Viettinbank.plist',
    'panel_wuling'      => __DIR__ . '/plist/Wuling.plist',
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
