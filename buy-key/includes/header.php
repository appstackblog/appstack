<?php

require_once __DIR__ . '/auth.php';

$pageTitle = $pageTitle ?? app_config()['APP_NAME'];
$activeNav = $activeNav ?? '';
start_secure_session();
$customer = current_customer();
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
        <nav class="main-nav" aria-label="Dieu huong chinh">
            <a class="<?= $activeNav === 'home' ? 'active' : '' ?>" href="<?= e(internal_url('/index.php')) ?>">Trang chu</a>
            <a class="<?= $activeNav === 'pricing' ? 'active' : '' ?>" href="<?= e(internal_url('/pricing.php')) ?>">Bang gia</a>
            <?php if ($customer): ?>
                <a class="<?= $activeNav === 'dashboard' ? 'active' : '' ?>" href="<?= e(internal_url('/dashboard.php')) ?>">Dashboard</a>
                <a class="<?= $activeNav === 'my-orders' ? 'active' : '' ?>" href="<?= e(internal_url('/my-orders.php')) ?>">Don hang cua toi</a>
                <a class="<?= $activeNav === 'my-keys' ? 'active' : '' ?>" href="<?= e(internal_url('/my-keys.php')) ?>">Key cua toi</a>
                <a class="<?= $activeNav === 'account' ? 'active' : '' ?>" href="<?= e(internal_url('/account.php')) ?>">Tai khoan</a>
                <a href="<?= e(internal_url('/logout.php')) ?>">Dang xuat</a>
            <?php else: ?>
                <a class="<?= $activeNav === 'free' ? 'active' : '' ?>" href="<?= e(internal_url('/free.php')) ?>">Key mien phi</a>
                <a class="<?= $activeNav === 'check' ? 'active' : '' ?>" href="<?= e(internal_url('/check.php')) ?>">Kiem tra key</a>
                <a class="<?= $activeNav === 'login' ? 'active' : '' ?>" href="<?= e(internal_url('/login.php')) ?>">Dang nhap</a>
                <a class="<?= $activeNav === 'register' ? 'active' : '' ?>" href="<?= e(internal_url('/register.php')) ?>">Dang ky</a>
            <?php endif; ?>
        </nav>
    </div>
</header>
<main>
