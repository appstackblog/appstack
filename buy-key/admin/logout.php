<?php

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_csrf();
    logout_admin();
    redirect(site_url('/admin/login.php'));
}

$pageTitle = 'Đăng xuất - FlameTech Admin';
require __DIR__ . '/../includes/header.php';
?>

<section class="section">
    <div class="container narrow">
        <form class="form-card" method="post">
            <?= csrf_field() ?>
            <h1>Đăng xuất</h1>
            <p class="muted">Kết thúc phiên đăng nhập quản trị hiện tại.</p>
            <button class="btn btn-primary full" type="submit">Đăng xuất</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
