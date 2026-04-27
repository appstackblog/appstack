<?php

require_once __DIR__ . '/../includes/auth.php';
require_admin();

$pdo = db();
$status = trim((string) ($_GET['status'] ?? ''));
$allowedStatuses = ['pending', 'completed', 'used', 'expired'];

if (in_array($status, $allowedStatuses, true)) {
    $stmt = $pdo->prepare('SELECT * FROM free_claims WHERE status = ? ORDER BY id DESC LIMIT 200');
    $stmt->execute([$status]);
    $claims = $stmt->fetchAll();
} else {
    $claims = $pdo->query('SELECT * FROM free_claims ORDER BY id DESC LIMIT 200')->fetchAll();
}

$pageTitle = 'Lượt nhận key miễn phí - FlameTech Admin';
require __DIR__ . '/../includes/header.php';
?>

<section class="page-hero compact">
    <div class="container admin-title-row">
        <div>
            <span class="eyebrow">Quản trị</span>
            <h1>Lượt nhận key miễn phí</h1>
            <p>Theo dõi phiên vượt link, key miễn phí đã tạo, địa chỉ IP và trạng thái xử lý.</p>
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
            <a href="<?= e(internal_url('/admin/orders.php')) ?>">Đơn hàng</a>
            <a class="active" href="<?= e(internal_url('/admin/free-claims.php')) ?>">Lượt nhận key miễn phí</a>
        </div>

        <div class="filter-row">
            <a class="<?= $status === '' ? 'active' : '' ?>" href="<?= e(internal_url('/admin/free-claims.php')) ?>">Tất cả</a>
            <?php foreach ($allowedStatuses as $filter): ?>
                <a class="<?= $status === $filter ? 'active' : '' ?>" href="<?= e(internal_url('/admin/free-claims.php?status=' . urlencode($filter))) ?>"><?= e(status_label($filter, 'claim')) ?></a>
            <?php endforeach; ?>
        </div>

        <div class="table-card">
            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Trạng thái</th>
                        <th>IP</th>
                        <th>Key đã tạo</th>
                        <th>Ngày tạo</th>
                        <th>Hoàn tất</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($claims as $claim): ?>
                        <tr>
                            <td><?= e($claim['id']) ?></td>
                            <td><?= e($claim['email']) ?></td>
                            <td><span class="<?= e(status_badge_class((string) $claim['status'])) ?>"><?= e(status_label((string) $claim['status'], 'claim')) ?></span></td>
                            <td><?= e($claim['ip_address'] ?? '') ?></td>
                            <td class="key-cell"><?= $claim['generated_key'] ? '<code>' . e($claim['generated_key']) . '</code>' : '<span class="muted">Chưa có</span>' ?></td>
                            <td><?= e($claim['created_at']) ?></td>
                            <td><?= e($claim['completed_at'] ?? '') ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
