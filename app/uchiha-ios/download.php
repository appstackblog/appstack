<?php
// Secure IPA download endpoint
$id = $_GET['id'] ?? '';

// Whitelisted map: id => absolute file path
$maps = [
    'panel_chiba'        => __DIR__ . '/ipas/Chiba.ipa',
    'panel_chiba2'       => __DIR__ . '/ipas/Chiba2.ipa',
    'panel_elec'         => __DIR__ . '/ipas/Elec.ipa',
    'panel_elec2'        => __DIR__ . '/ipas/Elec2.ipa',
    'panel_emi'          => __DIR__ . '/ipas/Emi.ipa',
    'panel_postal'       => __DIR__ . '/ipas/Postal.ipa',
    'panel_rural'        => __DIR__ . '/ipas/Rural.ipa',
    'panel_takeoff'      => __DIR__ . '/ipas/Takeoff.ipa',
    'panel_takeoff2'     => __DIR__ . '/ipas/Takeoff2.ipa',
    'panel_takeoff3'     => __DIR__ . '/ipas/Takeoff3.ipa',
    'panel_telecom'      => __DIR__ . '/ipas/Telecom.ipa',
    'panel_tianjin'      => __DIR__ . '/ipas/Tianjin.ipa',
    'panel_truck'        => __DIR__ . '/ipas/Truck.ipa',
    'panel_viettel'      => __DIR__ . '/ipas/Viettel.ipa',
    'panel_viettinbank'  => __DIR__ . '/ipas/Viettinbank.ipa',
    'panel_viettinbank2' => __DIR__ . '/ipas/Viettinbank2.ipa',
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
