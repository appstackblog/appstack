<?php
require __DIR__ . '/time.php';

// Ưu tiên phục vụ main.html nếu tồn tại
$main = __DIR__ . '/main.html';
if (is_file($main)) {
    readfile($main);
    exit;
}

// Fallback: trang tối giản với version động cho CSS/JS
$cssVer = asset_ver('quasar-veil.css');
$jsVer  = asset_ver('orbit-wisp.js');
?>
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AppStack</title>
  <link rel="stylesheet" href="./quasar-veil.css?v=<?=htmlspecialchars($cssVer, ENT_QUOTES)?>">
</head>
<body>
  <div class="top-menu-frame">
    <button class="nav-toggle" type="button" aria-label="Menu">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <a class="nav-logo" href="/">
      <img src="img/hehe.gif" alt="AppStack logo">
    </a>
    <div class="nav-labels">
      <a class="home" href="/">Trang chủ</a>
      <a class="menu" href="/app/index.php">Menu App iOS</a>
    </div>
  </div>
  <div class="nav-overlay" hidden aria-hidden="true"></div>
  <nav class="side-menu" aria-label="Menu di động">
    <button class="close-btn" type="button" aria-label="Đóng menu">×</button>
    <div class="search-box">
      <div class="search-icon" aria-hidden="true"></div>
      <input type="search" placeholder="Tìm kiếm..." aria-label="Tìm kiếm">
    </div>
    <a href="/" class="side-link">Trang chủ</a>
    <a href="/app/index.php" class="side-link">Menu App iOS</a>
  </nav>
  <script src="./orbit-wisp.js?v=<?=htmlspecialchars($jsVer, ENT_QUOTES)?>"></script>
</body>
</html>
