<?php
$id = $_GET['id'] ?? '';

$maps = [
    'fat_bank'        => __DIR__ . '/ipas-fat/Bank.ipa',
    'fat_chiba'       => __DIR__ . '/ipas-fat/Chiba.ipa',
    'fat_chinatelecom'=> __DIR__ . '/ipas-fat/ChinaTelecom.ipa',
    'fat_education'   => __DIR__ . '/ipas-fat/Education.ipa',
    'fat_eeo'         => __DIR__ . '/ipas-fat/Eeo.ipa',
    'fat_eryuan'      => __DIR__ . '/ipas-fat/Eryuan.ipa',
    'fat_esen'        => __DIR__ . '/ipas-fat/Esen.ipa',
    'fat_infor'       => __DIR__ . '/ipas-fat/Infor.ipa',
    'fat_mkt'         => __DIR__ . '/ipas-fat/Mkt.ipa',
    'fat_takeoff'     => __DIR__ . '/ipas-fat/Takeoff.ipa',
    'fat_telecom'     => __DIR__ . '/ipas-fat/Telecom.ipa',
    'fat_tianjin'     => __DIR__ . '/ipas-fat/Tianjin.ipa',
    'fat_truck'       => __DIR__ . '/ipas-fat/Truck.ipa',
    'fat_viettel'     => __DIR__ . '/ipas-fat/Viettel.ipa',
    'fat_viettinbank' => __DIR__ . '/ipas-fat/Viettinbank.ipa',
    'fat_wuling'      => __DIR__ . '/ipas-fat/Wuling.ipa',
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

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($target) . '"');
header('Content-Length: ' . filesize($target));
readfile($target);
exit;
