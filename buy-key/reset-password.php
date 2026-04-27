<?php

require_once __DIR__ . '/includes/auth.php';
start_secure_session();

$verified = !empty($_SESSION['password_reset_email_verified']);
$email = normalize_email((string) ($_SESSION['password_reset_email'] ?? ''));
if (!$verified || !valid_email($email)) {
    redirect(site_url('/forgot-password.php'));
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        $password = (string) ($_POST['password'] ?? '');
        $confirm = (string) ($_POST['password_confirm'] ?? '');

        if (strlen($password) < 8) {
            throw new InvalidArgumentException('Mat khau moi phai co toi thieu 8 ky tu.');
        }

        if ($password !== $confirm) {
            throw new InvalidArgumentException('Mat khau nhap lai khong khop.');
        }

        $stmt = db()->prepare('UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE email = ?');
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $email]);
        unset($_SESSION['password_reset_email_verified'], $_SESSION['password_reset_email']);
        redirect(site_url('/login.php?reset=1'));
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Dat lai mat khau - FlameTech';
$activeNav = 'login';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Khoi phuc tai khoan</span>
        <h1>Dat lai mat khau</h1>
        <p>Tao mat khau moi cho email <?= e($email) ?>.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($error): ?><div class="notice danger"><?= e($error) ?></div><?php endif; ?>
        <form class="form-card auth-card" method="post">
            <?= csrf_field() ?>
            <label for="password">Mat khau moi</label>
            <div class="password-wrap">
                <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
                <button class="password-toggle" type="button" data-toggle-password="#password">Hien</button>
            </div>
            <label for="password_confirm">Nhap lai mat khau moi</label>
            <div class="password-wrap">
                <input id="password_confirm" name="password_confirm" type="password" autocomplete="new-password" minlength="8" required>
                <button class="password-toggle" type="button" data-toggle-password="#password_confirm">Hien</button>
            </div>
            <button class="btn btn-primary full" type="submit" data-loading="Dang cap nhat...">Cap nhat mat khau</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
