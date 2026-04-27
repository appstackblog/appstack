<?php

require_once __DIR__ . '/includes/auth.php';

logout_customer();
redirect(site_url('/login.php?logged_out=1'));
