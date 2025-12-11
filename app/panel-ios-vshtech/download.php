<?php
$id = $_GET['id'] ?? '';

$maps = [
    'panel_chiba'        => __DIR__ . '/ipas/signed_chiba.ipa',
    'panel_chinatelecom' => __DIR__ . '/ipas/signed_chinatelecom.ipa',
    'panel_education'    => __DIR__ . '/ipas/signed_education.ipa',
    'panel_Eryuan'       => __DIR__ . '/ipas/signed_Eryuan.ipa',
    'panel_takeoff'      => __DIR__ . '/ipas/signed_takeoff.ipa',
    'panel_Tianjin'      => __DIR__ . '/ipas/signed_Tianjin.ipa',
    'panel_truck'        => __DIR__ . '/ipas/signed_truck.ipa',
    'panel_vietnambank'  => __DIR__ . '/ipas/signed_vietnambank.ipa',
    'panel_wuling'       => __DIR__ . '/ipas/signed_wuling.ipa',
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
