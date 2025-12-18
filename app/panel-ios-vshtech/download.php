<?php
// Secure IPA download endpoint
$id = $_GET['id'] ?? '';

// Whitelisted map: id => absolute file path
$maps = [
    'panel_bank'         => __DIR__ . '/ipas/Bank.ipa',
    'panel_chiba'        => __DIR__ . '/ipas/Chiba.ipa',
    'panel_chinatelecom' => __DIR__ . '/ipas/ChinaTelecom.ipa',
    'panel_education'    => __DIR__ . '/ipas/Education.ipa',
    'panel_eeo'          => __DIR__ . '/ipas/Eeo.ipa',
    'panel_eryuan'       => __DIR__ . '/ipas/Eryuan.ipa',
    'panel_esen'         => __DIR__ . '/ipas/Esen.ipa',
    'panel_infor'        => __DIR__ . '/ipas/Infor.ipa',
    'panel_mkt'          => __DIR__ . '/ipas/Mkt.ipa',
    'panel_takeoff'      => __DIR__ . '/ipas/Takeoff.ipa',
    'panel_telecom'      => __DIR__ . '/ipas/Telecom.ipa',
    'panel_tianjin'      => __DIR__ . '/ipas/Tianjin.ipa',
    'panel_truck'        => __DIR__ . '/ipas/Truck.ipa',
    'panel_viettel'      => __DIR__ . '/ipas/Viettel.ipa',
    'panel_viettinbank'  => __DIR__ . '/ipas/Viettinbank.ipa',
    'panel_wuling'       => __DIR__ . '/ipas/Wuling.ipa',
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

// Tránh timeout và dọn các buffer trước khi stream
@set_time_limit(0);
while (ob_get_level()) {
    ob_end_clean();
}

clearstatcache(true, $target);
$size = filesize($target);
if ($size === false) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($target) . '"');
header('Content-Length: ' . $size);
header('Cache-Control: no-store');

$fp = fopen($target, 'rb');
if ($fp === false) {
    http_response_code(500);
    exit('Cannot open file');
}

while (!feof($fp)) {
    echo fread($fp, 8192);
}
fclose($fp);
exit;
