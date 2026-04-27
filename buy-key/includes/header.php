<?php

require_once __DIR__ . '/csrf.php';

$pageTitle = $pageTitle ?? app_config()['APP_NAME'];
$activeNav = $activeNav ?? '';
start_secure_session();
?>
<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="index,follow">
    <title><?= e($pageTitle) ?></title>
    <link rel="stylesheet" href="<?= e(asset_url('css/style.css')) ?>">
</head>
<body>
<header class="site-header">
    <div class="container nav-wrap">
        <a class="brand" href="<?= e(internal_url('/index.php')) ?>">
            <span class="brand-mark">F</span>
            <span>FlameTech</span>
        </a>
        <nav class="main-nav" aria-label="Điều hướng chính">
            <a class="<?= $activeNav === 'home' ? 'active' : '' ?>" href="<?= e(internal_url('/index.php')) ?>">Trang chủ</a>
            <a class="<?= $activeNav === 'pricing' ? 'active' : '' ?>" href="<?= e(internal_url('/pricing.php')) ?>">Bảng giá</a>
            <a class="<?= $activeNav === 'free' ? 'active' : '' ?>" href="<?= e(internal_url('/free.php')) ?>">Key miễn phí</a>
            <a class="<?= $activeNav === 'check' ? 'active' : '' ?>" href="<?= e(internal_url('/check.php')) ?>">Kiểm tra key</a>
        </nav>
    </div>
</header>
<main>
