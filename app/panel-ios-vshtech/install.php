<?php
$id = $_GET['id'] ?? '';

$maps = [
    'panel_chiba'        => __DIR__ . '/plist/signed_chiba.plist',
    'panel_chinatelecom' => __DIR__ . '/plist/signed_chinatelecom.plist',
    'panel_education'    => __DIR__ . '/plist/signed_education.plist',
    'panel_Eryuan'       => __DIR__ . '/plist/signed_Eryuan.plist',
    'panel_takeoff'      => __DIR__ . '/plist/signed_takeoff.plist',
    'panel_Tianjin'      => __DIR__ . '/plist/signed_Tianjin.plist',
    'panel_truck'        => __DIR__ . '/plist/signed_truck.plist',
    'panel_vietnambank'  => __DIR__ . '/plist/signed_vietnambank.plist',
    'panel_wuling'       => __DIR__ . '/plist/signed_wuling.plist',
    'panel_chinamobile'  => __DIR__ . '/plist/signed_chinamobile.plist',
    'panel_bocom'        => __DIR__ . '/plist/signed_bocom.plist',
    'panel_icbc'         => __DIR__ . '/plist/signed_icbc.plist',
    'panel_cspg'         => __DIR__ . '/plist/signed_cspg.plist',
    'panel_ccb'          => __DIR__ . '/plist/signed_ccb.plist',
    'panel_boc'          => __DIR__ . '/plist/signed_boc.plist',
    'panel_sjtu'         => __DIR__ . '/plist/signed_sjtu.plist',
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
