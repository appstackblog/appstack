<?php

return [
    'APP_NAME' => 'FlameTech Key bản quyền',
    'APP_ENV' => 'production',
    'APP_DEBUG' => true,

    'DB_HOST' => 'sql111.infinityfree.com',
    'DB_NAME' => 'if0_41764782_buykey',
    'DB_USER' => 'if0_41764782',
    'DB_PASS' => 'mfFBljGb8e',

    'SITE_URL' => 'https://buykey.xo.je',

    'WORKER_BASE_URL' => 'https://flametech.hdangchinhchu.workers.dev',
    'WORKER_ADMIN_KEY' => 'vsh_admin_8G9RzJ42XkM',

    'PAYMENT_PROVIDER' => 'sepay',
    'PAYMENT_WEBHOOK_SECRET' => 'buykey_webhook_secret_2026',

    'BANK_NAME' => 'MBBANK',
    'BANK_ACCOUNT_NAME' => 'CHU THE HAI DANG',
    'BANK_ACCOUNT_NUMBER' => '9920666666',
    'BANK_BIN' => '970422',

    'FREE_LINK_BASE_URL' => '',
    'FREE_LINK_SECRET' => 'change-me-free-link-secret',

    'ADMIN_EMAILS' => 'admin@example.com',

    'PLANS' => [
        'premium_1_month' => [
            'name' => 'Premium 1 tháng',
            'tier' => 'vip',
            'duration' => '30d',
            'amount' => 99000.00,
            'currency' => 'VND',
        ],
        'premium_3_months' => [
            'name' => 'Premium 3 tháng',
            'tier' => 'vip',
            'duration' => '90d',
            'amount' => 249000.00,
            'currency' => 'VND',
        ],
        'premium_6_months' => [
            'name' => 'Premium 6 tháng',
            'tier' => 'vip',
            'duration' => '180d',
            'amount' => 449000.00,
            'currency' => 'VND',
        ],
    ],

    'ORDER_EXPIRE_HOURS' => 24,
    'FREE_RATE_LIMIT_HOURS' => 24,
    'WORKER_VERIFY_PATH' => '/api/verify',
    'WORKER_VERIFY_REQUIRES_ADMIN_KEY' => false,
];
