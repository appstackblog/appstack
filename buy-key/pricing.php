<?php

$pageTitle = 'Bảng giá - FlameTech Key bản quyền';
$activeNav = 'pricing';
require_once __DIR__ . '/includes/header.php';

$plans = app_plans();
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Truy cập VIP</span>
        <h1>Chọn gói Premium phù hợp với nhu cầu của bạn</h1>
        <p>Mỗi đơn Premium sẽ tạo 1 key VIP sau khi hệ thống xác nhận chuyển khoản thành công.</p>
    </div>
</section>

<section class="section">
    <div class="container plan-grid large">
        <?php foreach ($plans as $code => $plan): ?>
            <article class="plan-card featured-card">
                <div>
                    <h2><?= e($plan['name']) ?></h2>
                    <p class="price"><?= e(format_money($plan['amount'], $plan['currency'] ?? 'VND')) ?></p>
                    <p class="muted">Loại key: <?= e(strtoupper($plan['tier'])) ?> - Thời hạn: <?= e($plan['duration']) ?></p>
                </div>
                <ul class="feature-list">
                    <li>Tự động cấp key sau khi xác nhận thanh toán</li>
                    <li>Mỗi đơn hàng có nội dung chuyển khoản riêng</li>
                    <li>Key bản quyền được tạo bởi Cloudflare Worker</li>
                </ul>
                <a class="btn btn-primary full" href="<?= e(internal_url('/checkout.php?plan=' . urlencode((string) $code))) ?>">Mua <?= e($plan['name']) ?></a>
            </article>
        <?php endforeach; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
