<?php

require_once __DIR__ . '/includes/auth.php';
require_customer_login();

$customer = current_customer();
attach_existing_orders_to_customer((int) $customer['id'], (string) $customer['email']);
$pdo = db();
$hasOrderCustomer = db_column_exists($pdo, 'orders', 'customer_id');
$hasClaimCustomer = db_column_exists($pdo, 'free_claims', 'customer_id');

$orderWhere = $hasOrderCustomer ? '(customer_id = ? OR LOWER(email) = ?)' : 'LOWER(email) = ?';
$orderParams = $hasOrderCustomer ? [(int) $customer['id'], strtolower((string) $customer['email'])] : [strtolower((string) $customer['email'])];
$claimWhere = $hasClaimCustomer ? '(customer_id = ? OR LOWER(email) = ?)' : 'LOWER(email) = ?';
$claimParams = $hasClaimCustomer ? [(int) $customer['id'], strtolower((string) $customer['email'])] : [strtolower((string) $customer['email'])];

$stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE ' . $orderWhere);
$stmt->execute($orderParams);
$totalOrders = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE ' . $orderWhere . ' AND status = "paid"');
$stmt->execute($orderParams);
$paidOrders = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE ' . $orderWhere . ' AND generated_key IS NOT NULL AND generated_key <> ""');
$stmt->execute($orderParams);
$premiumKeys = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT COUNT(*) FROM free_claims WHERE ' . $claimWhere . ' AND generated_key IS NOT NULL AND generated_key <> ""');
$stmt->execute($claimParams);
$freeKeys = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT * FROM orders WHERE ' . $orderWhere . ' ORDER BY id DESC LIMIT 5');
$stmt->execute($orderParams);
$recentOrders = $stmt->fetchAll();

$pageTitle = 'Dashboard - FlameTech';
$activeNav = 'dashboard';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Dashboard</span>
        <h1>Xin chao<?= !empty($customer['name']) ? ', ' . e($customer['name']) : '' ?></h1>
        <p>Quan ly don hang va key gan voi email <?= e($customer['email']) ?>.</p>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="metric-grid">
            <div class="metric"><span>Tong don hang</span><strong><?= e($totalOrders) ?></strong></div>
            <div class="metric"><span>Don da thanh toan</span><strong><?= e($paidOrders) ?></strong></div>
            <div class="metric"><span>Key premium</span><strong><?= e($premiumKeys) ?></strong></div>
            <div class="metric"><span>Key mien phi</span><strong><?= e($freeKeys) ?></strong></div>
        </div>

        <div class="table-card">
            <div class="card-head">
                <div>
                    <span class="eyebrow">Gan day</span>
                    <h2>Don hang moi</h2>
                </div>
                <a class="text-link" href="<?= e(internal_url('/my-orders.php')) ?>">Xem tat ca</a>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Ma don</th><th>Goi</th><th>So tien</th><th>Trang thai</th><th>Ngay tao</th><th></th></tr></thead>
                    <tbody>
                    <?php if (!$recentOrders): ?>
                        <tr><td colspan="6">Chua co don hang nao.</td></tr>
                    <?php endif; ?>
                    <?php foreach ($recentOrders as $order): ?>
                        <tr>
                            <td><code><?= e($order['transfer_content']) ?></code></td>
                            <td><?= e(plan_label((string) $order['plan_code'])) ?></td>
                            <td><?= e(format_money($order['amount'], (string) $order['currency'])) ?></td>
                            <td><span class="<?= e(status_badge_class((string) $order['status'])) ?>"><?= e(status_label((string) $order['status'])) ?></span></td>
                            <td><?= e($order['created_at']) ?></td>
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
