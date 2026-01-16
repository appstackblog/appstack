<?php
$name_file = "uuid.mobileconfig";
$path = __DIR__ . "/../assets/dns/" . $name_file;

if (file_exists($path)) {
	header("Content-type: application/x-apple-aspen-config; charset=utf-8");
	header("Content-Disposition: attachment; filename=\"$name_file\"");
	header("Content-Length: " . filesize($path));
	header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
	readfile($path);
} else {
	echo "File Not Found.";
	die;
}
