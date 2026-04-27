<?php

require_once __DIR__ . '/../includes/auth.php';
require_admin();

$pdo = db();
$counts = [
    'orders_pending' => 0,
    'orders_paid' => 0,
    'free_completed' => 0,
    'free_pending' => 0,
];

$counts['orders_pending'] = (int) $pdo->query('SELECT COUNT(*) FROM orders WHERE status = "pending"')->fetchColumn();
$counts['orders_paid'] = (int) $pdo->query('SELECT COUNT(*) FROM orders WHERE status = "paid"')->fetchColumn();
$counts['free_completed'] = (int) $pdo->query('SELECT COUNT(*) FROM free_claims WHERE status = "completed"')->fetchColumn();
$counts['free_pending'] = (int) $pdo->query('SELECT COUNT(*) FROM free_claims WHERE status = "pending"')->fetchColumn();

$recentOrders = $pdo->query('SELECT * FROM orders ORDER BY id DESC LIMIT 5')->fetchAll();

$pageTitle = 'Bảng quản trị - FlameTech Key bản quyền';
require __DIR__ . '/../includes/header.php';
?>

<section class="page-hero compact">
    <div class="container admin-title-row">
        <div>
            <span class="eyebrow">Quản trị</span>
            <h1>Bảng quản trị</h1>
            <p>Đang đăng nhập với tài khoản <?= e(current_admin()['email'] ?? '') ?>.</p>
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
            <a class="active" href="<?= e(internal_url('/admin/index.php')) ?>">Bảng quản trị</a>
            <a href="<?= e(internal_url('/admin/orders.php')) ?>">Đơn hàng</a>
            <a href="<?= e(internal_url('/admin/free-claims.php')) ?>">Lượt nhận key miễn phí</a>
        </div>

        <div class="metric-grid">
            <div class="metric"><span>Đơn chờ thanh toán</span><strong><?= e($counts['orders_pending']) ?></strong></div>
            <div class="metric"><span>Đơn đã thanh toán</span><strong><?= e($counts['orders_paid']) ?></strong></div>
            <div class="metric"><span>Lượt miễn phí đã hoàn tất</span><strong><?= e($counts['free_completed']) ?></strong></div>
            <div class="metric"><span>Lượt miễn phí đang chờ</span><strong><?= e($counts['free_pending']) ?></strong></div>
        </div>

        <div class="table-card">
            <div class="card-head">
                <h2>Đơn hàng gần đây</h2>
                <a class="text-link" href="<?= e(internal_url('/admin/orders.php')) ?>">Xem tất cả</a>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Gói</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($recentOrders as $order): ?>
                        <tr>
                            <td><?= e($order['id']) ?></td>
                            <td><?= e($order['email']) ?></td>
                            <td><?= e(plan_label((string) $order['plan_code'])) ?></td>
                            <td><span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span></td>
                            <td><?= e($order['created_at']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
