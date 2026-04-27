<?php

require_once __DIR__ . '/../includes/auth.php';

if (admin_logged_in()) {
    redirect(site_url('/admin/index.php'));
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_csrf();

    $email = normalize_email((string) ($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    try {
        if (login_admin(db(), $email, $password)) {
            redirect(site_url('/admin/index.php'));
        }
        $error = 'Email hoặc mật khẩu quản trị không đúng.';
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Đăng nhập quản trị - FlameTech Key bản quyền';
require __DIR__ . '/../includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Quản trị</span>
        <h1>Đăng nhập</h1>
        <p>Truy cập đơn hàng, lượt nhận key miễn phí, key đã tạo và trạng thái thanh toán webhook.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($error): ?>
            <div class="notice danger"><?= e($error) ?></div>
        <?php endif; ?>
        <form class="form-card" method="post">
            <?= csrf_field() ?>
            <label for="email">Email quản trị</label>
            <input id="email" name="email" type="email" autocomplete="email" required>

            <label for="password">Mật khẩu</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>

            <button class="btn btn-primary full" type="submit">Đăng nhập</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
