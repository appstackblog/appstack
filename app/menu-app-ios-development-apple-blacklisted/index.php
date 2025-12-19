<?php
// Simple bridge to keep redirect logic on the server side.
$id = isset($_GET['id']) ? trim($_GET['id']) : '';

$target = './panel/panel-ios-vshtech/';
if ($id !== '') {
    $target .= '?id=' . rawurlencode($id);
}

header('Location: ' . $target, true, 302);
exit;
