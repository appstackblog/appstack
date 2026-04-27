<?php

require_once __DIR__ . '/includes/auth.php';
require_customer_login();

$customer = current_customer();
$pdo = db();
attach_existing_orders_to_customer((int) $customer['id'], (string) $customer['email']);
$hasCustomer = db_column_exists($pdo, 'orders', 'customer_id');
$where = $hasCustomer ? '(customer_id = ? OR LOWER(email) = ?)' : 'LOWER(email) = ?';
$params = $hasCustomer ? [(int) $customer['id'], strtolower((string) $customer['email'])] : [strtolower((string) $customer['email'])];

$status = trim((string) ($_GET['status'] ?? ''));
if (in_array($status, ['pending', 'paid', 'failed', 'expired'], true)) {
    $where .= ' AND status = ?';
    $params[] = $status;
}

$stmt = $pdo->prepare('SELECT * FROM orders WHERE ' . $where . ' ORDER BY id DESC LIMIT 200');
$stmt->execute($params);
$orders = $stmt->fetchAll();

$pageTitle = 'Don hang cua toi - FlameTech';
$activeNav = 'my-orders';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tai khoan</span>
        <h1>Don hang cua toi</h1>
        <p>Lich su don hang premium gan voi tai khoan va email cua ban.</p>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="filter-row">
            <a class="<?= $status === '' ? 'active' : '' ?>" href="<?= e(internal_url('/my-orders.php')) ?>">Tat ca</a>
            <?php foreach (['pending', 'paid', 'expired', 'failed'] as $item): ?>
                <a class="<?= $status === $item ? 'active' : '' ?>" href="<?= e(internal_url('/my-orders.php?status=' . urlencode($item))) ?>"><?= e(status_label($item)) ?></a>
            <?php endforeach; ?>
        </div>
        <div class="table-card">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Ma don</th><th>Goi</th><th>So tien</th><th>Trang thai</th><th>Ngay tao</th><th>Ngay thanh toan</th><th></th></tr></thead>
                    <tbody>
                    <?php if (!$orders): ?><tr><td colspan="7">Chua co don hang nao.</td></tr><?php endif; ?>
                    <?php foreach ($orders as $order): ?>
                        <tr>
                            <td><code><?= e($order['transfer_content']) ?></code></td>
                            <td><?= e(plan_label((string) $order['plan_code'])) ?></td>
                            <td><?= e(format_money($order['amount'], (string) $order['currency'])) ?></td>
                            <td><span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span></td>
                            <td><?= e($order['created_at']) ?></td>
                            <td><?= e($order['paid_at'] ?: '-') ?></td>
                            <td><a class="text-link" href="<?= e(internal_url('/order.php?id=' . urlencode((string) $order['public_id']))) ?>">Mo</a></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
