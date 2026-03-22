<?php
// Manifest generator for itms-services (Flame Tech)
$id = $_GET['id'] ?? '';

$maps = [
    'fat_bank'         => ['file' => __DIR__ . '/plist-flt/Bank.plist',        'title' => 'Bank'],
    'fat_chiba'        => ['file' => __DIR__ . '/plist-flt/Chiba.plist',       'title' => 'Chiba'],
    'fat_chinatelecom' => ['file' => __DIR__ . '/plist-flt/China.plist',       'title' => 'China'],
    'fat_education'    => ['file' => __DIR__ . '/plist-flt/Elec.plist',        'title' => 'Elec'],
    'fat_eeo'          => ['file' => __DIR__ . '/plist-flt/Inter.plist',       'title' => 'Inter'],
    'fat_eryuan'       => ['file' => __DIR__ . '/plist-flt/Postal.plist',      'title' => 'Postal'],
    'fat_esen'         => ['file' => __DIR__ . '/plist-flt/Power.plist',       'title' => 'Power'],
    'fat_infor'        => ['file' => __DIR__ . '/plist-flt/Rural.plist',       'title' => 'Rural'],
    'fat_mkt'          => ['file' => __DIR__ . '/plist-flt/Varco.plist',       'title' => 'Varco'],
    'fat_takeoff'      => ['file' => __DIR__ . '/plist-flt/Takeoff.plist',     'title' => 'Takeoff'],
    'fat_telecom'      => ['file' => __DIR__ . '/plist-flt/Telecom.plist',     'title' => 'Telecom'],
    'fat_tianjin'      => ['file' => __DIR__ . '/plist-flt/Tianjin.plist',     'title' => 'Tianjin'],
    'fat_truck'        => ['file' => __DIR__ . '/plist-flt/Truck.plist',       'title' => 'Truck'],
    'fat_viettel'      => ['file' => __DIR__ . '/plist-flt/Viettel.plist',     'title' => 'Viettel'],
    'fat_viettinbank'  => ['file' => __DIR__ . '/plist-flt/Vn.plist',          'title' => 'Vn'],
    'fat_wuling'       => ['file' => __DIR__ . '/plist-flt/Wasu.plist',        'title' => 'Wasu'],
];

if (!isset($maps[$id])) {
    http_response_code(404);
    exit('Not found');
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '';
if (!$host) {
    http_response_code(400);
    exit('Host header missing');
}
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$scriptDir = rtrim($scriptDir, '/');
$base = "{$scheme}://{$host}{$scriptDir}";
$downloadUrl = $base . '/download.php?id=' . rawurlencode($id);

$tplPath = $maps[$id]['file'] ?? null;
$plist = '';

if ($tplPath && is_file($tplPath)) {
    $plist = file_get_contents($tplPath);
    if ($plist === false) {
        http_response_code(500);
        exit('Cannot read manifest');
    }
    // Force the manifest to use the current app URL regardless of template origin.
    $plist = preg_replace('#https?://[^"<]+/download\\.php\\?id=[^"<]+#', $downloadUrl, $plist);
    $plist = str_replace('Fatx007 Turbo', 'Flame Tech', $plist);
} else {
    // Fallback minimal manifest if template missing
    $title = $maps[$id]['title'] ?? $id;
    $plist = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key><string>software-package</string>
          <key>url</key><string>{$downloadUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key><string>com.appstack.{$id}</string>
        <key>bundle-version</key><string>1.0</string>
        <key>kind</key><string>software</string>
        <key>title</key><string>{$title}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
XML;
}

header('Content-Type: application/xml');
header('Cache-Control: no-store');
echo $plist;
exit;
