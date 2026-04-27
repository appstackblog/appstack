<?php

$pageTitle = 'Key miễn phí - FlameTech Key bản quyền';
$activeNav = 'free';
require_once __DIR__ . '/includes/header.php';

$error = trim((string) ($_GET['error'] ?? ''));
$customer = current_customer();
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Truy cập miễn phí mỗi ngày</span>
        <h1>Nhận key miễn phí 1 ngày</h1>
        <p>Nhập email, hoàn thành bước xác minh/vượt link, hệ thống sẽ tự động yêu cầu Worker tạo key miễn phí cho bạn.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($error): ?>
            <div class="notice danger"><?= e($error) ?></div>
        <?php endif; ?>
        <form class="form-card" method="post" action="<?= e(internal_url('/api/free-start.php')) ?>">
            <?= csrf_field() ?>
            <label for="email">Địa chỉ email</label>
            <input id="email" name="email" type="email" maxlength="255" autocomplete="email" required placeholder="email-cua-ban@example.com" value="<?= e($customer['email'] ?? '') ?>" <?= $customer ? 'readonly' : '' ?>>
            <?php if ($customer): ?>
                <p class="form-note">Key mien phi se duoc gan vao tai khoan dang nhap.</p>
            <?php endif; ?>
            <button class="btn btn-primary full" type="submit" data-loading="Đang bắt đầu...">Nhận key miễn phí</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
