<?php

require_once __DIR__ . '/includes/auth.php';

if (is_customer_logged_in()) {
    redirect(site_url('/dashboard.php'));
}

$error = '';
$email = normalize_email((string) ($_POST['email'] ?? ''));
$name = trim((string) ($_POST['name'] ?? ''));

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        $password = (string) ($_POST['password'] ?? '');
        $confirm = (string) ($_POST['password_confirm'] ?? '');

        if ($password !== $confirm) {
            throw new InvalidArgumentException('Mat khau nhap lai khong khop.');
        }

        register_customer($email, $password, $name);
        send_customer_otp($email, 'verify_email');
        redirect(site_url('/verify-otp.php?email=' . urlencode($email) . '&purpose=verify_email'));
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Tao tai khoan - FlameTech';
$activeNav = 'register';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tai khoan khach hang</span>
        <h1>Tao tai khoan</h1>
        <p>Dang ky de quan ly don hang, key da mua va key mien phi theo email cua ban.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($error): ?>
            <div class="notice danger"><?= e($error) ?></div>
        <?php endif; ?>
        <form class="form-card auth-card" method="post">
            <?= csrf_field() ?>
            <label for="name">Ten hien thi</label>
            <input id="name" name="name" type="text" maxlength="255" autocomplete="name" value="<?= e($name) ?>" placeholder="Ten cua ban">

            <label for="email">Email</label>
            <input id="email" name="email" type="email" maxlength="255" autocomplete="email" required value="<?= e($email) ?>">

            <label for="password">Mat khau</label>
            <div class="password-wrap">
                <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
                <button class="password-toggle" type="button" data-toggle-password="#password">Hien</button>
            </div>

            <label for="password_confirm">Nhap lai mat khau</label>
            <div class="password-wrap">
                <input id="password_confirm" name="password_confirm" type="password" autocomplete="new-password" minlength="8" required>
                <button class="password-toggle" type="button" data-toggle-password="#password_confirm">Hien</button>
            </div>

            <button class="btn btn-primary full" type="submit" data-loading="Dang tao tai khoan...">Dang ky</button>
            <p class="form-note">Da co tai khoan? <a class="text-link" href="<?= e(internal_url('/login.php')) ?>">Dang nhap</a></p>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
