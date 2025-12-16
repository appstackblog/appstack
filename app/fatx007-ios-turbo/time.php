<?php
function asset_ver(string $relativePath): string {
  $path = __DIR__ . '/' . ltrim($relativePath, '/');
  if (file_exists($path)) {
    return (string)filemtime($path);
  }
  return (string)time();
}
