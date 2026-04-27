<?php

require_once __DIR__ . '/includes/auth.php';
require_customer_login();

$customer = current_customer();
$pdo = db();
attach_existing_orders_to_customer((int) $customer['id'], (string) $customer['email']);
$email = strtolower((string) $customer['email']);

$hasOrderCustomer = db_column_exists($pdo, 'orders', 'customer_id');
$orderWhere = $hasOrderCustomer ? '(customer_id = ? OR LOWER(email) = ?)' : 'LOWER(email) = ?';
$orderParams = $hasOrderCustomer ? [(int) $customer['id'], $email] : [$email];
$stmt = $pdo->prepare(
    'SELECT public_id, transfer_content, plan_code, generated_key, key_generated_at, created_at
     FROM orders
     WHERE ' . $orderWhere . '
     AND status = "paid"
     AND generated_key IS NOT NULL
     AND generated_key <> ""
     ORDER BY id DESC'
);
$stmt->execute($orderParams);
$premiumKeys = $stmt->fetchAll();

$hasClaimCustomer = db_column_exists($pdo, 'free_claims', 'customer_id');
$claimWhere = $hasClaimCustomer ? '(customer_id = ? OR LOWER(email) = ?)' : 'LOWER(email) = ?';
$claimParams = $hasClaimCustomer ? [(int) $customer['id'], $email] : [$email];
$stmt = $pdo->prepare(
    'SELECT public_id, generated_key, key_generated_at, created_at
     FROM free_claims
     WHERE ' . $claimWhere . '
     AND status = "completed"
     AND generated_key IS NOT NULL
     AND generated_key <> ""
     ORDER BY id DESC'
);
$stmt->execute($claimParams);
$freeKeys = $stmt->fetchAll();

$pageTitle = 'Key cua toi - FlameTech';
$activeNav = 'my-keys';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tai khoan</span>
        <h1>Key cua toi</h1>
        <p>Tat ca key premium va key mien phi da tao cho email <?= e($customer['email']) ?>.</p>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="table-card">
            <div class="card-head"><h2>Key premium</h2></div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Key</th><th>Goi</th><th>Ma don</th><th>Ngay tao key</th><th></th></tr></thead>
                    <tbody>
                    <?php if (!$premiumKeys): ?><tr><td colspan="5">Chua co key premium.</td></tr><?php endif; ?>
                    <?php foreach ($premiumKeys as $row): ?>
                        <tr>
                            <td class="key-cell"><code><?= e($row['generated_key']) ?></code></td>
                            <td><?= e(plan_label((string) $row['plan_code'])) ?></td>
                            <td><code><?= e($row['transfer_content']) ?></code></td>
                            <td><?= e($row['key_generated_at'] ?: $row['created_at']) ?></td>
                            <td><button class="btn btn-small js-copy" type="button" data-copy="<?= e($row['generated_key']) ?>">Copy</button></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="table-card mt-20">
            <div class="card-head"><h2>Key mien phi</h2></div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Key</th><th>Loai</th><th>Ma claim</th><th>Ngay tao key</th><th></th></tr></thead>
                    <tbody>
                    <?php if (!$freeKeys): ?><tr><td colspan="5">Chua co key mien phi.</td></tr><?php endif; ?>
                    <?php foreach ($freeKeys as $row): ?>
                        <tr>
                            <td class="key-cell"><code><?= e($row['generated_key']) ?></code></td>
                            <td>Free 1 ngay</td>
                            <td><code><?= e($row['public_id']) ?></code></td>
                            <td><?= e($row['key_generated_at'] ?: $row['created_at']) ?></td>
                            <td><button class="btn btn-small js-copy" type="button" data-copy="<?= e($row['generated_key']) ?>">Copy</button></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
