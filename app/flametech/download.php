<?php
// Secure IPA download endpoint for Flame Tech
$id = $_GET['id'] ?? '';

$maps = [
    'fat_bank'         => __DIR__ . '/ipas-flt/Bank.ipa',
    'fat_chiba'        => __DIR__ . '/ipas-flt/Chiba.ipa',
    'fat_chinatelecom' => __DIR__ . '/ipas-flt/China.ipa',
    'fat_education'    => __DIR__ . '/ipas-flt/Elec.ipa',
    'fat_eeo'          => __DIR__ . '/ipas-flt/Inter.ipa',
    'fat_eryuan'       => __DIR__ . '/ipas-flt/Postal.ipa',
    'fat_esen'         => __DIR__ . '/ipas-flt/Power.ipa',
    'fat_infor'        => __DIR__ . '/ipas-flt/Rural.ipa',
    'fat_mkt'          => __DIR__ . '/ipas-flt/Varco.ipa',
    'fat_takeoff'      => __DIR__ . '/ipas-flt/Takeoff.ipa',
    'fat_telecom'      => __DIR__ . '/ipas-flt/Telecom.ipa',
    'fat_tianjin'      => __DIR__ . '/ipas-flt/Tianjin.ipa',
    'fat_truck'        => __DIR__ . '/ipas-flt/Truck.ipa',
    'fat_viettel'      => __DIR__ . '/ipas-flt/Viettel.ipa',
    'fat_viettinbank'  => __DIR__ . '/ipas-flt/Vn.ipa',
    'fat_wuling'       => __DIR__ . '/ipas-flt/Wasu.ipa',
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
