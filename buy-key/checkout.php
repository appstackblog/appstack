<?php

$pageTitle = 'Thanh toán - FlameTech Key bản quyền';
$activeNav = 'pricing';
require_once __DIR__ . '/includes/header.php';

$plans = app_plans();
$order = null;
$systemError = '';
$selectedPlanCode = trim((string) ($_GET['plan'] ?? ''));
$error = trim((string) ($_GET['error'] ?? ''));

if (isset($_GET['id'])) {
    try {
        $order = find_order_by_public_id(db(), trim((string) $_GET['id']));
    } catch (Throwable $e) {
        $systemError = app_error_message($e);
    }
}

if (!$selectedPlanCode || !get_plan($selectedPlanCode)) {
    $selectedPlanCode = '';
    foreach ($plans as $code => $plan) {
        $selectedPlanCode = (string) $code;
        break;
    }
}
$selectedPlan = get_plan($selectedPlanCode);
$customer = current_customer();
?>

<?php if ($systemError): ?>
    <section class="page-hero compact">
        <div class="container">
            <span class="eyebrow">Thanh toán</span>
            <h1>Không thể tải thông tin đơn hàng</h1>
            <p>Hệ thống chưa thể kết nối hoặc truy xuất dữ liệu đơn hàng lúc này.</p>
        </div>
    </section>

    <section class="section">
        <div class="container narrow">
            <div class="notice danger"><?= e($systemError) ?></div>
            <a class="btn btn-primary full" href="<?= e(internal_url('/checkout.php?plan=' . urlencode($selectedPlanCode))) ?>">Quay lại form thanh toán</a>
        </div>
    </section>
<?php elseif ($order): ?>
    <section class="page-hero compact">
        <div class="container">
            <span class="eyebrow">Đơn hàng đã tạo</span>
            <h1>Hoàn tất chuyển khoản ngân hàng</h1>
            <p>Vui lòng chuyển khoản đúng số tiền và đúng nội dung để hệ thống xử lý tự động.</p>
        </div>
    </section>

    <section class="section" <?= $order['status'] === 'pending' ? 'data-auto-refresh="45"' : '' ?>>
        <div class="container checkout-grid">
            <article class="payment-card">
                <div class="card-head">
                    <div>
                        <span class="eyebrow">Đơn hàng</span>
                        <h2><?= e(plan_label((string) $order['plan_code'])) ?></h2>
                    </div>
                    <span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span>
                </div>

                <?php if ($order['status'] === 'pending'): ?>
                    <div class="amount-box">
                        <span>Số tiền cần chuyển</span>
                        <strong><?= e(format_money($order['amount'], (string) $order['currency'])) ?></strong>
                    </div>
                    <div class="transfer-code">
                        <span>Nội dung chuyển khoản</span>
                        <code><?= e($order['transfer_content']) ?></code>
                        <button class="icon-btn js-copy" data-copy="<?= e($order['transfer_content']) ?>" type="button">Sao chép</button>
                    </div>
                    <dl class="bank-list">
                        <div><dt>Ngân hàng</dt><dd><?= e(app_config()['BANK_NAME'] ?? '') ?></dd></div>
                        <div><dt>Chủ tài khoản</dt><dd><?= e(app_config()['BANK_ACCOUNT_NAME'] ?? '') ?></dd></div>
                        <div><dt>Số tài khoản</dt><dd><?= e(app_config()['BANK_ACCOUNT_NUMBER'] ?? '') ?></dd></div>
                    </dl>
                    <a class="btn btn-secondary full" href="<?= e(internal_url('/order.php?id=' . urlencode((string) $order['public_id']))) ?>">Xem trạng thái đơn hàng</a>
                <?php elseif ($order['status'] === 'paid' && !empty($order['generated_key'])): ?>
                    <div class="key-box">
                        <span>Key VIP của bạn</span>
                        <code><?= e($order['generated_key']) ?></code>
                        <button class="btn btn-primary js-copy" data-copy="<?= e($order['generated_key']) ?>" type="button">Sao chép key</button>
                    </div>
                <?php else: ?>
                    <p class="notice warning">Đơn hàng hiện ở trạng thái <?= e(status_label((string) $order['status'])) ?>. Vui lòng tạo đơn mới nếu bạn vẫn cần key.</p>
                <?php endif; ?>
            </article>

            <aside class="qr-card">
                <?php $qrUrl = bank_qr_url($order); ?>
                <?php if ($qrUrl): ?>
                    <img src="<?= e($qrUrl) ?>" alt="Mã QR chuyển khoản ngân hàng">
                <?php else: ?>
                    <div class="qr-placeholder">QR</div>
                <?php endif; ?>
                <p class="muted">Sau khi webhook xác nhận thanh toán, trang đơn hàng sẽ hiển thị key VIP đã tạo.</p>
            </aside>
        </div>
    </section>
<?php else: ?>
    <section class="page-hero compact">
        <div class="container">
            <span class="eyebrow">Thanh toán</span>
            <h1>Tạo đơn hàng Premium</h1>
            <p>Chọn thời hạn VIP và nhập email dùng để hỗ trợ khi cần tra cứu đơn hàng.</p>
        </div>
    </section>

    <section class="section">
        <div class="container narrow">
            <?php if ($error): ?>
                <div class="notice danger"><?= e($error) ?></div>
            <?php endif; ?>
            <form class="form-card" method="post" action="<?= e(internal_url('/api/create-order.php')) ?>">
                <?= csrf_field() ?>
                <label for="plan_code">Gói Premium</label>
                <select id="plan_code" name="plan_code" required>
                    <?php foreach ($plans as $code => $plan): ?>
                        <option value="<?= e($code) ?>" <?= $code === $selectedPlanCode ? 'selected' : '' ?>>
                            <?= e($plan['name'] . ' - ' . format_money($plan['amount'], $plan['currency'] ?? 'VND')) ?>
                        </option>
                    <?php endforeach; ?>
                </select>

                <label for="email">Địa chỉ email</label>
                <input id="email" name="email" type="email" maxlength="255" autocomplete="email" required placeholder="email-cua-ban@example.com" value="<?= e($customer['email'] ?? '') ?>" <?= $customer ? 'readonly' : '' ?>>
                <?php if ($customer): ?>
                    <p class="form-note">Don hang se duoc gan vao tai khoan dang nhap.</p>
                <?php endif; ?>

                <?php if ($selectedPlan): ?>
                    <div class="summary-line">
                        <span>Thời hạn đã chọn</span>
                        <strong><?= e($selectedPlan['duration']) ?></strong>
                    </div>
                <?php endif; ?>

                <button class="btn btn-primary full" type="submit" data-loading="Đang tạo đơn hàng...">Tạo đơn hàng</button>
            </form>
        </div>
    </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
