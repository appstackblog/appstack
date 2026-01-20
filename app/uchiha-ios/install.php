<?php
// Manifest generator for itms-services
$id = $_GET['id'] ?? '';

// Map id => plist template file and (optional) display name; if no template, we build minimal manifest.
$maps = [
    'panel_bank'         => ['file' => __DIR__ . '/plist/Bank.plist',        'title' => 'Bank'],
    'panel_chiba'        => ['file' => __DIR__ . '/plist/Chiba.plist',       'title' => 'Chiba'],
    'panel_chinatelecom' => ['file' => __DIR__ . '/plist/ChinaTelecom.plist','title' => 'ChinaTelecom'],
    'panel_education'    => ['file' => __DIR__ . '/plist/Education.plist',   'title' => 'Education'],
    'panel_eeo'          => ['file' => __DIR__ . '/plist/Eeo.plist',         'title' => 'Eeo'],
    'panel_eryuan'       => ['file' => __DIR__ . '/plist/Eryuan.plist',      'title' => 'Eryuan'],
    'panel_esen'         => ['file' => __DIR__ . '/plist/Esen.plist',        'title' => 'Esen'],
    'panel_infor'        => ['file' => __DIR__ . '/plist/Infor.plist',       'title' => 'Infor'],
    'panel_mkt'          => ['file' => __DIR__ . '/plist/Mkt.plist',         'title' => 'Mkt'],
    'panel_takeoff'      => ['file' => __DIR__ . '/plist/Takeoff.plist',     'title' => 'Takeoff'],
    'panel_telecom'      => ['file' => __DIR__ . '/plist/Telecom.plist',     'title' => 'Telecom'],
    'panel_tianjin'      => ['file' => __DIR__ . '/plist/Tianjin.plist',     'title' => 'Tianjin'],
    'panel_truck'        => ['file' => __DIR__ . '/plist/Truck.plist',       'title' => 'Truck'],
    'panel_viettel'      => ['file' => __DIR__ . '/plist/Viettel.plist',     'title' => 'Viettel'],
    'panel_viettinbank'  => ['file' => __DIR__ . '/plist/Viettinbank.plist', 'title' => 'Viettinbank'],
    'panel_wuling'       => ['file' => __DIR__ . '/plist/Wuling.plist',      'title' => 'Wuling'],
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
$base = "{$scheme}://{$host}/app/panel-ios-vshtech";
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
    $plist = preg_replace('#https?://[^"]+/app/panel-ios-vshtech/download\\.php\\?id=[^"<]+#', $downloadUrl, $plist);
    // Also handle old domain without /app
    $plist = str_replace('https://appstack.blog/panel-ios-vshtech/download.php', $base . '/download.php', $plist);
    $plist = str_replace('https://appstack.blog/app/panel-ios-vshtech/download.php', $base . '/download.php', $plist);
    $plist = str_replace('https://appstack.blog/app/panel-ios-vshtech/download.php?id=' . $id, $downloadUrl, $plist);
    $plist = str_replace('https://appstack.blog/panel-ios-vshtech/download.php?id=' . $id, $downloadUrl, $plist);
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
