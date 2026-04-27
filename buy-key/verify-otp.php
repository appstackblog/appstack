<?php

require_once __DIR__ . '/includes/auth.php';

$email = normalize_email((string) ($_GET['email'] ?? $_POST['email'] ?? ''));
$purpose = (string) ($_GET['purpose'] ?? $_POST['purpose'] ?? 'verify_email');
$allowedPurposes = ['verify_email', 'reset_password', 'login_verify'];
if (!in_array($purpose, $allowedPurposes, true)) {
    $purpose = 'verify_email';
}

$error = '';
$message = '';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    try {
        verify_csrf();
        $action = (string) ($_POST['action'] ?? 'verify');

        if (!valid_email($email)) {
            throw new InvalidArgumentException('Email khong hop le.');
        }

        if ($action === 'resend') {
            send_customer_otp($email, $purpose);
            $message = 'Ma OTP moi da duoc gui. Vui long kiem tra email.';
        } else {
            $otp = (string) ($_POST['otp'] ?? '');
            if (!verify_customer_otp($email, $otp, $purpose)) {
                throw new InvalidArgumentException('Ma OTP khong dung hoac da het han.');
            }

            $customer = find_customer_by_email($email);
            if ($purpose === 'verify_email') {
                if (!$customer) {
                    throw new RuntimeException('Khong tim thay tai khoan.');
                }

                $stmt = db()->prepare('UPDATE customers SET email_verified = 1, updated_at = NOW() WHERE id = ?');
                $stmt->execute([(int) $customer['id']]);
                $customer['email_verified'] = 1;
                login_customer($customer);
                attach_existing_orders_to_customer((int) $customer['id'], (string) $customer['email']);
                redirect(site_url('/dashboard.php?verified=1'));
            }

            if ($purpose === 'reset_password') {
                start_secure_session();
                $_SESSION['password_reset_email_verified'] = true;
                $_SESSION['password_reset_email'] = $email;
                redirect(site_url('/reset-password.php'));
            }

            redirect(site_url('/dashboard.php'));
        }
    } catch (Throwable $e) {
        $error = app_error_message($e);
    }
}

$pageTitle = 'Xac thuc OTP - FlameTech';
$activeNav = '';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Bao mat tai khoan</span>
        <h1>Xac thuc OTP</h1>
        <p>Nhap ma 6 so da gui toi email <?= e($email) ?>. Ma co hieu luc trong 10 phut.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if ($message): ?>
            <div class="notice success"><?= e($message) ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="notice danger"><?= e($error) ?></div>
        <?php endif; ?>
        <form class="form-card auth-card" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="email" value="<?= e($email) ?>">
            <input type="hidden" name="purpose" value="<?= e($purpose) ?>">

            <label for="otp">Ma OTP</label>
            <input class="otp-input" id="otp" name="otp" type="text" inputmode="numeric" pattern="\d{6}" maxlength="6" autocomplete="one-time-code" required>

            <button class="btn btn-primary full" type="submit" name="action" value="verify" data-loading="Dang xac thuc...">Xac thuc</button>
            <button class="btn btn-secondary full" type="submit" name="action" value="resend" data-loading="Dang gui lai...">Gui lai ma</button>
        </form>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
