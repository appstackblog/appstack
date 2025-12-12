<?php
// Ưu tiên phục vụ nội dung từ main.html nếu có
$main = __DIR__ . '/main.html';
if (is_file($main)) {
  readfile($main);
  exit;
}

// Nếu không có main.html, fallback trả về index.html
readfile(__DIR__ . '/index.html');
