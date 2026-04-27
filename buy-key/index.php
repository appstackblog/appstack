<?php

$pageTitle = 'FlameTech Key bản quyền - Cấp key tự động';
$activeNav = 'home';
require __DIR__ . '/includes/header.php';
$plans = app_plans();
?>

<section class="hero">
    <div class="container hero-grid">
        <div class="hero-copy">
            <span class="eyebrow">Cấp key tự động</span>
            <h1>Nhận key bản quyền FlameTech ngay sau khi thanh toán thành công.</h1>
            <p>Mua gói Premium bằng chuyển khoản ngân hàng hoặc nhận key miễn phí mỗi ngày qua bước xác minh/vượt link. Toàn bộ key được tạo và lưu bởi Cloudflare Worker.</p>
            <div class="hero-actions">
                <a class="btn btn-primary" href="<?= e(internal_url('/free.php')) ?>">Nhận key miễn phí</a>
                <a class="btn btn-secondary" href="<?= e(internal_url('/pricing.php')) ?>">Mua Premium</a>
            </div>
        </div>
        <div class="hero-panel">
            <div class="security-stack">
                <div>
                    <span>Website bán key</span>
                    <strong>PHP + MySQL</strong>
                </div>
                <div>
                    <span>Thanh toán</span>
                    <strong>Webhook xác thực</strong>
                </div>
                <div>
                    <span>Nguồn tạo key</span>
                    <strong>Cloudflare Worker</strong>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container split">
        <div>
            <span class="eyebrow">Cách hệ thống hoạt động</span>
            <h2>Xác nhận thanh toán trước, tạo key sau.</h2>
            <p class="muted">Website ghi nhận đơn hàng hoặc lượt nhận key miễn phí, xác minh thanh toán hoặc bước vượt link, sau đó PHP backend mới gọi Worker bằng khóa riêng. Trình duyệt không bao giờ nhận secret.</p>
        </div>
        <div class="steps">
            <div class="step"><span>1</span><p>Chọn gói Premium hoặc bắt đầu nhận key miễn phí.</p></div>
            <div class="step"><span>2</span><p>Hoàn tất chuyển khoản ngân hàng hoặc bước xác minh/vượt link.</p></div>
            <div class="step"><span>3</span><p>Nhận key bản quyền do Worker tạo trên trang kết quả.</p></div>
        </div>
    </div>
</section>

<section class="section section-soft">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Gói Premium</span>
            <h2>Thời hạn VIP</h2>
            <a class="text-link" href="<?= e(internal_url('/pricing.php')) ?>">Xem bảng giá</a>
        </div>
        <div class="plan-grid">
            <?php foreach ($plans as $code => $plan): ?>
                <article class="plan-card">
                    <h3><?= e($plan['name']) ?></h3>
                    <p class="price"><?= e(format_money($plan['amount'], $plan['currency'] ?? 'VND')) ?></p>
                    <p class="muted">Key VIP, thời hạn sử dụng <?= e($plan['duration']) ?>.</p>
                    <a class="btn btn-card" href="<?= e(internal_url('/checkout.php?plan=' . urlencode((string) $code))) ?>">Mua ngay</a>
                </article>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head">
            <div>
                <span class="eyebrow">Câu hỏi thường gặp</span>
                <h2>Thông tin cần biết</h2>
            </div>
        </div>
        <div class="faq-grid">
            <article class="faq-item">
                <h3>Khi nào tôi nhận được key?</h3>
                <p>Sau khi webhook xác nhận thanh toán thành công, hệ thống sẽ tự động tạo và hiển thị key trên trang đơn hàng.</p>
            </article>
            <article class="faq-item">
                <h3>Key miễn phí hoạt động như thế nào?</h3>
                <p>Bạn cần nhập email và hoàn thành bước xác minh/vượt link. Mỗi lượt nhận key miễn phí có thể bị giới hạn theo email hoặc địa chỉ IP.</p>
            </article>
            <article class="faq-item">
                <h3>Website có tự tạo key không?</h3>
                <p>Không. Website chỉ xử lý đơn hàng và gọi Cloudflare Worker bảo mật từ PHP backend để tạo key.</p>
            </article>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
