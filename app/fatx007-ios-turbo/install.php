<?php
// Manifest generator for itms-services (Fatx007)
$id = $_GET['id'] ?? '';

$maps = [
    'fat_bank'         => ['file' => __DIR__ . '/plist-fat/Bank.plist',        'title' => 'Bank'],
    'fat_chiba'        => ['file' => __DIR__ . '/plist-fat/Chiba.plist',       'title' => 'Chiba'],
    'fat_chinatelecom' => ['file' => __DIR__ . '/plist-fat/ChinaTelecom.plist','title' => 'ChinaTelecom'],
    'fat_education'    => ['file' => __DIR__ . '/plist-fat/Education.plist',   'title' => 'Education'],
    'fat_eeo'          => ['file' => __DIR__ . '/plist-fat/Eeo.plist',         'title' => 'Eeo'],
    'fat_eryuan'       => ['file' => __DIR__ . '/plist-fat/Eryuan.plist',      'title' => 'Eryuan'],
    'fat_esen'         => ['file' => __DIR__ . '/plist-fat/Esen.plist',        'title' => 'Esen'],
    'fat_infor'        => ['file' => __DIR__ . '/plist-fat/Infor.plist',       'title' => 'Infor'],
    'fat_mkt'          => ['file' => __DIR__ . '/plist-fat/Mkt.plist',         'title' => 'Mkt'],
    'fat_takeoff'      => ['file' => __DIR__ . '/plist-fat/Takeoff.plist',     'title' => 'Takeoff'],
    'fat_telecom'      => ['file' => __DIR__ . '/plist-fat/Telecom.plist',     'title' => 'Telecom'],
    'fat_tianjin'      => ['file' => __DIR__ . '/plist-fat/Tianjin.plist',     'title' => 'Tianjin'],
    'fat_truck'        => ['file' => __DIR__ . '/plist-fat/Truck.plist',       'title' => 'Truck'],
    'fat_viettel'      => ['file' => __DIR__ . '/plist-fat/Viettel.plist',     'title' => 'Viettel'],
    'fat_viettinbank'  => ['file' => __DIR__ . '/plist-fat/Viettinbank.plist', 'title' => 'Viettinbank'],
    'fat_wuling'       => ['file' => __DIR__ . '/plist-fat/Wuling.plist',      'title' => 'Wuling'],
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
$base = "{$scheme}://{$host}/app/fatx007-ios-turbo";
$downloadUrl = $base . '/download.php?id=' . rawurlencode($id);

$tplPath = $maps[$id]['file'] ?? null;
$plist = '';

if ($tplPath && is_file($tplPath)) {
    $plist = file_get_contents($tplPath);
    if ($plist === false) {
        http_response_code(500);
        exit('Cannot read manifest');
    }
    // Force correct download URL inside the manifest
    $plist = preg_replace('#https?://[^"]+/app/fatx007-ios-turbo/download\\.php\\?id=[^"<]+#', $downloadUrl, $plist);
    // Also handle old domain without /app
    $plist = str_replace('https://appstack.blog/fatx007-ios-turbo/download.php', $base . '/download.php', $plist);
    $plist = str_replace('https://appstack.blog/app/fatx007-ios-turbo/download.php', $base . '/download.php', $plist);
    $plist = str_replace('https://appstack.blog/app/fatx007-ios-turbo/download.php?id=' . $id, $downloadUrl, $plist);
    $plist = str_replace('https://appstack.blog/fatx007-ios-turbo/download.php?id=' . $id, $downloadUrl, $plist);
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
