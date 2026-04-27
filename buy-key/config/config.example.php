<?php

return [
    'APP_NAME' => 'FlameTech Key bản quyền',
    'APP_ENV' => 'production',
    'APP_DEBUG' => false,

    'DB_HOST' => 'localhost',
    'DB_NAME' => 'appstack_buykey',
    'DB_USER' => 'appstack_buykeyuser',
    'DB_PASS' => '!Hdchu2006!',

    'SITE_URL' => 'https://appstack.blog/buy-key',

    'WORKER_BASE_URL' => 'https://flametech.hdangchinhchu.workers.dev',
    'WORKER_ADMIN_KEY' => 'change-me-worker-admin-key',

    'PAYMENT_PROVIDER' => 'placeholder',
    'PAYMENT_WEBHOOK_SECRET' => 'buykey_webhook_secret_2026',

    'BANK_NAME' => 'MBBANK',
    'BANK_ACCOUNT_NAME' => 'CHU THE HAI DANG',
    'BANK_ACCOUNT_NUMBER' => '9920666666',
    'BANK_BIN' => '970422',

    'FREE_LINK_BASE_URL' => 'https://link-provider.example/unlock?callback={callback}',
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
    'WORKER_VERIFY_PATH' => '/api/keys/verify',
    'WORKER_VERIFY_REQUIRES_ADMIN_KEY' => false,
];
