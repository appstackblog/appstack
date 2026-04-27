<?php

$pageTitle = 'Kiểm tra key - FlameTech Key bản quyền';
$activeNav = 'check';
require_once __DIR__ . '/includes/header.php';
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Tra cứu license</span>
        <h1>Kiểm tra key bản quyền</h1>
        <p>Key được gửi tới PHP backend và kiểm tra qua endpoint xác minh của Cloudflare Worker.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <form id="key-check-form" class="form-card" method="post" action="<?= e(internal_url('/api/check-key.php')) ?>">
            <?= csrf_field() ?>
            <label for="key">Key bản quyền</label>
            <input id="key" name="key" type="text" maxlength="255" required placeholder="Ví dụ: Vip-FlameTech-ABCDE-FGHIJ-KLMN">
            <button class="btn btn-primary full" type="submit" data-loading="Đang kiểm tra...">Kiểm tra key</button>
        </form>
        <div id="key-check-result" class="result-panel" hidden></div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
