<?php

$pageTitle = 'Trạng thái đơn hàng - FlameTech Key bản quyền';
$activeNav = '';
require_once __DIR__ . '/includes/header.php';

$order = null;
$id = trim((string) ($_GET['id'] ?? ''));
if ($id !== '') {
    $order = find_order_by_public_id(db(), $id);
}
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Trạng thái đơn hàng</span>
        <h1><?= $order ? e(plan_label((string) $order['plan_code'])) : 'Không tìm thấy đơn hàng' ?></h1>
        <p>Đơn hàng đang chờ sẽ tự cập nhật sau khi webhook xác nhận đúng nội dung chuyển khoản.</p>
    </div>
</section>

<section class="section" <?= $order && $order['status'] === 'pending' ? 'data-auto-refresh="45"' : '' ?>>
    <div class="container narrow">
        <?php if (!$order): ?>
            <div class="notice danger">Không tìm thấy đơn hàng. Vui lòng kiểm tra lại liên kết từ trang thanh toán.</div>
        <?php else: ?>
            <article class="status-card">
                <div class="card-head">
                    <div>
                        <span class="eyebrow">Mã chuyển khoản</span>
                        <h2><?= e($order['transfer_content']) ?></h2>
                    </div>
                    <span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span>
                </div>

                <?php if ($order['status'] === 'pending'): ?>
                    <p class="notice">Vui lòng chuyển khoản <?= e(format_money($order['amount'], (string) $order['currency'])) ?> với nội dung <strong><?= e($order['transfer_content']) ?></strong>.</p>
                    <dl class="bank-list">
                        <div><dt>Ngân hàng</dt><dd><?= e(app_config()['BANK_NAME'] ?? '') ?></dd></div>
                        <div><dt>Chủ tài khoản</dt><dd><?= e(app_config()['BANK_ACCOUNT_NAME'] ?? '') ?></dd></div>
                        <div><dt>Số tài khoản</dt><dd><?= e(app_config()['BANK_ACCOUNT_NUMBER'] ?? '') ?></dd></div>
                    </dl>
                    <?php $qrUrl = bank_qr_url($order); ?>
                    <?php if ($qrUrl): ?>
                        <img class="qr-inline" src="<?= e($qrUrl) ?>" alt="Mã QR chuyển khoản ngân hàng">
                    <?php endif; ?>
                    <div class="button-row">
                        <button class="btn btn-secondary" type="button" onclick="window.location.reload()">Làm mới trạng thái</button>
                        <button class="btn btn-card js-copy" type="button" data-copy="<?= e($order['transfer_content']) ?>">Sao chép nội dung chuyển khoản</button>
                    </div>
                <?php elseif ($order['status'] === 'paid' && !empty($order['generated_key'])): ?>
                    <div class="key-box">
                        <span>Key VIP của bạn</span>
                        <code><?= e($order['generated_key']) ?></code>
                        <button class="btn btn-primary js-copy" data-copy="<?= e($order['generated_key']) ?>" type="button">Sao chép key</button>
                    </div>
                <?php elseif ($order['status'] === 'paid'): ?>
                    <p class="notice warning">Thanh toán đã được xác nhận. Key đang chờ tạo, vui lòng liên hệ hỗ trợ với mã <?= e($order['transfer_content']) ?> nếu trạng thái này kéo dài.</p>
                    <button class="btn btn-secondary" type="button" onclick="window.location.reload()">Làm mới trạng thái</button>
                <?php else: ?>
                    <p class="notice danger">Đơn hàng hiện ở trạng thái <?= e(status_label((string) $order['status'])) ?> và không thể thanh toán.</p>
                    <a class="btn btn-primary" href="<?= e(internal_url('/pricing.php')) ?>">Tạo đơn hàng mới</a>
                <?php endif; ?>
            </article>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
