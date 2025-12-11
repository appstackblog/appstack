<?php
// Temporary maintenance redirect to static notice
header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/maintenance.html');
