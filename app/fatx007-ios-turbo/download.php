<?php
$id = $_GET['id'] ?? '';

$maps = [
    'fat_chiba'          => __DIR__ . '/ipas-fat/fat_chiba.ipa',
    'fat_chinatelecom'   => __DIR__ . '/ipas-fat/fat_chinatelecom.ipa',
    'fat_education'      => __DIR__ . '/ipas-fat/fat_education.ipa',
    'fat_Eryuan'         => __DIR__ . '/ipas-fat/fat_Eryuan.ipa',
    'fat_takeoff'        => __DIR__ . '/ipas-fat/fat_takeoff.ipa',
    'fat_Tianjin'        => __DIR__ . '/ipas-fat/fat_Tianjin.ipa',
    'fat_truck'          => __DIR__ . '/ipas-fat/fat_truck.ipa',
    'fat_vietnambank'    => __DIR__ . '/ipas-fat/fat_vietnambank.ipa',
    'fat_wuling'         => __DIR__ . '/ipas-fat/fat_wuling.ipa',
    'fat_chinamobile'    => __DIR__ . '/ipas-fat/fat_chinamobile.ipa',
    'fat_bocom'          => __DIR__ . '/ipas-fat/fat_bocom.ipa',
    'fat_icbc'           => __DIR__ . '/ipas-fat/fat_icbc.ipa',
    'fat_cspg'           => __DIR__ . '/ipas-fat/fat_cspg.ipa',
    'fat_ccb'            => __DIR__ . '/ipas-fat/fat_ccb.ipa',
    'fat_boc'            => __DIR__ . '/ipas-fat/fat_boc.ipa',
    'fat_sjtu'           => __DIR__ . '/ipas-fat/fat_sjtu.ipa',
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
