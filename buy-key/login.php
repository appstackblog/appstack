<?php

require_once __DIR__ . '/includes/auth.php';

if (is_customer_logged_in()) {
    redirect(site_url('/dashboard.php'));
}

$error = '';
$email = normalize_email((string) ($_POST['email'] ?? ''));

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        $password = (string) ($_POST['password'] ?? '');
        $customer = find_customer_by_email($email);

        if (!$customer || !password_verify($password, (string) $customer['password_hash'])) {
            throw new InvalidArgumentException('Email hoac mat khau khong dung.');
        }

        if (($customer['status'] ?? '') !== 'active') {
            throw new InvalidArgumentException('Tai khoan dang bi khoa.');
        }

        if (empty($customer['email_verified'])) {
            send_customer_otp($email, 'verify_email');
            redirect(site_url('/verify-otp.php?email=' . urlencode($email) . '&purpose=verify_email'));
        }

        login_customer($customer);
        attach_existing_orders_to_customer((int) $customer['id'], (string) $customer['email']);

        start_secure_session();
        $target = (string) ($_SESSION['intended_url'] ?? site_url('/dashboard.php'));
        unset($_SESSION['intended_url']);
        redirect($target);
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Dang nhap - FlameTech';
$activeNav = 'login';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tai khoan khach hang</span>
        <h1>Dang nhap</h1>
        <p>Quan ly don hang, key premium va key mien phi trong mot dashboard.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($error): ?>
            <div class="notice danger"><?= e($error) ?></div>
        <?php endif; ?>
        <form class="form-card auth-card" method="post">
            <?= csrf_field() ?>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" maxlength="255" autocomplete="email" required value="<?= e($email) ?>">

            <label for="password">Mat khau</label>
            <div class="password-wrap">
                <input id="password" name="password" type="password" autocomplete="current-password" required>
                <button class="password-toggle" type="button" data-toggle-password="#password">Hien</button>
            </div>

            <label class="check-row">
                <input type="checkbox" name="remember" value="1">
                <span>Ghi nho tren thiet bi nay</span>
            </label>

            <button class="btn btn-primary full" type="submit" data-loading="Dang dang nhap...">Dang nhap</button>
            <div class="auth-links">
                <a class="text-link" href="<?= e(internal_url('/forgot-password.php')) ?>">Quen mat khau?</a>
                <a class="text-link" href="<?= e(internal_url('/register.php')) ?>">Tao tai khoan</a>
            </div>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
