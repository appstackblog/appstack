<?php

require_once __DIR__ . '/includes/auth.php';
require_customer_login();

$customer = current_customer();
$error = '';
$message = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        $current = (string) ($_POST['current_password'] ?? '');
        $password = (string) ($_POST['password'] ?? '');
        $confirm = (string) ($_POST['password_confirm'] ?? '');

        if (!password_verify($current, (string) $customer['password_hash'])) {
            throw new InvalidArgumentException('Mat khau hien tai khong dung.');
        }

        if (strlen($password) < 8) {
            throw new InvalidArgumentException('Mat khau moi phai co toi thieu 8 ky tu.');
        }

        if ($password !== $confirm) {
            throw new InvalidArgumentException('Mat khau nhap lai khong khop.');
        }

        $stmt = db()->prepare('UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), (int) $customer['id']]);
        $message = 'Da doi mat khau thanh cong.';
        $customer = current_customer();
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Tai khoan - FlameTech';
$activeNav = 'account';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tai khoan</span>
        <h1>Thong tin tai khoan</h1>
        <p>Quan ly email, trang thai xac thuc va mat khau.</p>
    </div>
</section>

<section class="section">
    <div class="container split">
        <article class="status-card">
            <h2>Ho so</h2>
            <dl class="bank-list">
                <div><dt>Email</dt><dd><?= e($customer['email']) ?></dd></div>
                <div><dt>Xac thuc</dt><dd><?= !empty($customer['email_verified']) ? 'Da xac thuc' : 'Chua xac thuc' ?></dd></div>
                <div><dt>Trang thai</dt><dd><?= e($customer['status']) ?></dd></div>
                <div><dt>Ngay tao</dt><dd><?= e($customer['created_at']) ?></dd></div>
            </dl>
        </article>

        <form class="form-card auth-card" method="post">
            <h2>Doi mat khau</h2>
            <?php if ($message): ?><div class="notice success"><?= e($message) ?></div><?php endif; ?>
            <?php if ($error): ?><div class="notice danger"><?= e($error) ?></div><?php endif; ?>
            <?= csrf_field() ?>
            <label for="current_password">Mat khau hien tai</label>
            <input id="current_password" name="current_password" type="password" autocomplete="current-password" required>
            <label for="password">Mat khau moi</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
            <label for="password_confirm">Nhap lai mat khau moi</label>
            <input id="password_confirm" name="password_confirm" type="password" autocomplete="new-password" minlength="8" required>
            <button class="btn btn-primary full" type="submit" data-loading="Dang cap nhat...">Doi mat khau</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
