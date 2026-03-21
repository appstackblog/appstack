<?php
require __DIR__ . '/time.php';

$cssVer = asset_ver('styles.css');
$jsVer = asset_ver('script.js');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$html = file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
  http_response_code(500);
  exit('Cannot read index.html');
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$endsWith = static function (string $value, string $suffix): bool {
  if ($suffix === '') {
    return true;
  }
  return substr($value, -strlen($suffix)) === $suffix;
};

$needsCanonicalUrl = $requestPath === '' || $endsWith($requestPath, '/index.php') || $endsWith($requestPath, '/');

if ($needsCanonicalUrl) {
  $canonicalScript = <<<'HTML'
<script>
(() => {
  const { pathname, search, hash } = window.location;
  if (pathname.endsWith('/index.html')) return;
  const targetPath = pathname.endsWith('/index.php')
    ? pathname.slice(0, -'index.php'.length) + 'index.html'
    : pathname.replace(/\/?$/, '/index.html');
  window.history.replaceState(null, '', targetPath + search + hash);
})();
</script>
HTML;
  $html = str_replace('</head>', $canonicalScript . "\n</head>", $html);
}

$search = [
  './styles.css',
  './script.js',
];

$replace = [
  './styles.css?v=' . $cssVer,
  './script.js?v=' . $jsVer,
];

echo str_replace($search, $replace, $html);
