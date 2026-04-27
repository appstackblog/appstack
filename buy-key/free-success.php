<?php

$pageTitle = 'Key miễn phí đã sẵn sàng - FlameTech Key bản quyền';
$activeNav = 'free';
require_once __DIR__ . '/includes/header.php';

$claim = null;
$id = trim((string) ($_GET['id'] ?? ''));
if ($id !== '') {
    $claim = find_free_claim_by_public_id(db(), $id);
}
?>

<section class="page-hero compact">
    <div class="container">
        <span class="eyebrow">Key miễn phí</span>
        <h1><?= $claim && !empty($claim['generated_key']) ? 'Key của bạn đã được tạo thành công' : 'Không tìm thấy lượt nhận key' ?></h1>
        <p>Key miễn phí được tạo bởi cùng Cloudflare Worker đang lưu trạng thái license.</p>
    </div>
</section>

<section class="section">
    <div class="container narrow">
        <?php if (!$claim): ?>
            <div class="notice danger">Không tìm thấy lượt nhận key miễn phí.</div>
        <?php elseif (($claim['status'] ?? '') === 'completed' && !empty($claim['generated_key'])): ?>
            <article class="status-card">
                <div class="key-box">
                    <span>Key miễn phí của bạn</span>
                    <code><?= e($claim['generated_key']) ?></code>
                    <button class="btn btn-primary js-copy" data-copy="<?= e($claim['generated_key']) ?>" type="button">Sao chép key</button>
                    <p class="muted">Hãy lưu key này ở nơi an toàn để sử dụng khi cần.</p>
                </div>
            </article>
        <?php else: ?>
            <div class="notice warning">Lượt nhận key đang ở trạng thái <?= e(status_label((string) $claim['status'], 'claim')) ?>, hiện chưa có key để hiển thị.</div>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
