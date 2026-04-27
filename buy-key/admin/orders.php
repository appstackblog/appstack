<?php

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/payment.php';
require_admin();

$pdo = db();
$message = trim((string) ($_GET['message'] ?? ''));
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_csrf();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'retry_key') {
        try {
            $publicId = trim((string) ($_POST['public_id'] ?? ''));
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('SELECT * FROM orders WHERE public_id = ? FOR UPDATE');
            $stmt->execute([$publicId]);
            $order = $stmt->fetch();

            if (!$order) {
                throw new RuntimeException('Không tìm thấy đơn hàng.');
            }
            if (($order['status'] ?? '') !== 'paid') {
                throw new InvalidArgumentException('Chỉ đơn hàng đã thanh toán mới có thể tạo key VIP.');
            }

            generate_key_for_paid_order($pdo, $order);
            $pdo->commit();
            redirect(site_url('/admin/orders.php?message=' . urlencode('Đã gửi lại yêu cầu tạo key.')));
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $error = app_error_message($e);
        }
    }
}

$status = trim((string) ($_GET['status'] ?? ''));
$allowedStatuses = ['pending', 'paid', 'failed', 'expired'];

if (in_array($status, $allowedStatuses, true)) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200');
    $stmt->execute([$status]);
    $orders = $stmt->fetchAll();
} else {
    $orders = $pdo->query('SELECT * FROM orders ORDER BY id DESC LIMIT 200')->fetchAll();
}

$pageTitle = 'Đơn hàng - FlameTech Admin';
require __DIR__ . '/../includes/header.php';
?>

<section class="page-hero compact">
    <div class="container admin-title-row">
        <div>
            <span class="eyebrow">Quản trị</span>
            <h1>Đơn hàng</h1>
            <p>Theo dõi trạng thái thanh toán, key VIP đã tạo và mã tham chiếu webhook.</p>
        </div>
        <form method="post" action="<?= e(internal_url('/admin/logout.php')) ?>">
            <?= csrf_field() ?>
            <button class="btn btn-secondary" type="submit">Đăng xuất</button>
        </form>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="admin-nav">
            <a href="<?= e(internal_url('/admin/index.php')) ?>">Bảng quản trị</a>
            <a class="active" href="<?= e(internal_url('/admin/orders.php')) ?>">Đơn hàng</a>
            <a href="<?= e(internal_url('/admin/free-claims.php')) ?>">Lượt nhận key miễn phí</a>
        </div>

        <?php if ($message): ?><div class="notice success"><?= e($message) ?></div><?php endif; ?>
        <?php if ($error): ?><div class="notice danger"><?= e($error) ?></div><?php endif; ?>

        <div class="filter-row">
            <a class="<?= $status === '' ? 'active' : '' ?>" href="<?= e(internal_url('/admin/orders.php')) ?>">Tất cả</a>
            <?php foreach ($allowedStatuses as $filter): ?>
                <a class="<?= $status === $filter ? 'active' : '' ?>" href="<?= e(internal_url('/admin/orders.php?status=' . urlencode($filter))) ?>"><?= e(status_label($filter)) ?></a>
            <?php endforeach; ?>
        </div>

        <div class="table-card">
            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Gói</th>
                        <th>Số tiền</th>
                        <th>Trạng thái</th>
                        <th>Nội dung CK</th>
                        <th>Key đã tạo</th>
                        <th>Mã thanh toán</th>
                        <th>Ngày tạo</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($orders as $order): ?>
                        <tr>
                            <td><?= e($order['id']) ?></td>
                            <td><?= e($order['email']) ?></td>
                            <td><?= e(plan_label((string) $order['plan_code'])) ?></td>
                            <td><?= e(format_money($order['amount'], (string) $order['currency'])) ?></td>
                            <td><span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span></td>
                            <td><code><?= e($order['transfer_content']) ?></code></td>
                            <td class="key-cell"><?= $order['generated_key'] ? '<code>' . e($order['generated_key']) . '</code>' : '<span class="muted">Chưa có</span>' ?></td>
                            <td><?= e($order['payment_reference'] ?? '') ?></td>
                            <td><?= e($order['created_at']) ?></td>
                            <td>
                                <?php if ($order['status'] === 'paid' && empty($order['generated_key'])): ?>
                                    <form method="post" class="inline-form">
                                        <?= csrf_field() ?>
                                        <input type="hidden" name="action" value="retry_key">
                                        <input type="hidden" name="public_id" value="<?= e($order['public_id']) ?>">
                                        <button class="btn btn-small" type="submit">Tạo lại</button>
                                    </form>
                                <?php else: ?>
                                    <a class="text-link" href="<?= e(internal_url('/order.php?id=' . urlencode((string) $order['public_id']))) ?>">Mở</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
