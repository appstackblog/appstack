<?php

require_once __DIR__ . '/includes/auth.php';

$message = '';
$error = '';
$email = normalize_email((string) ($_POST['email'] ?? ''));

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        if (!valid_email($email)) {
            throw new InvalidArgumentException('Vui long nhap email hop le.');
        }

        if (find_customer_by_email($email)) {
            send_customer_otp($email, 'reset_password');
            redirect(site_url('/verify-otp.php?email=' . urlencode($email) . '&purpose=reset_password'));
        }

        $message = 'Neu email ton tai, chung toi da gui ma OTP dat lai mat khau.';
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Quen mat khau - FlameTech';
$activeNav = 'login';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Khoi phuc tai khoan</span>
        <h1>Quen mat khau</h1>
        <p>Nhap email tai khoan de nhan ma OTP dat lai mat khau.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($message): ?><div class="notice success"><?= e($message) ?></div><?php endif; ?>
        <?php if ($error): ?><div class="notice danger"><?= e($error) ?></div><?php endif; ?>
        <form class="form-card auth-card" method="post">
            <?= csrf_field() ?>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" maxlength="255" autocomplete="email" required value="<?= e($email) ?>">
            <button class="btn btn-primary full" type="submit" data-loading="Dang gui OTP...">Gui ma OTP</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
