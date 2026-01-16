<?php
$name_file = "uuid.mobileconfig";
$path = __DIR__ . "/../assets/dns/" . $name_file;

if (file_exists($path)) {
	header("Content-type: application/x-apple-aspen-config; chatset=utf-8");
	header("Content-Disposition: attachment; filename=\"$name_file\"");
	readfile($path);
} else {
	echo "File Not Found.";
	die;
}
