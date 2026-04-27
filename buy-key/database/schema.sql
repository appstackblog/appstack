CREATE TABLE orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    plan_code VARCHAR(50) NOT NULL,
    duration VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    status ENUM('pending','paid','failed','expired') DEFAULT 'pending',
    transfer_content VARCHAR(100) UNIQUE NOT NULL,
    payment_provider VARCHAR(50) NULL,
    payment_reference VARCHAR(255) NULL,
    generated_key TEXT NULL,
    worker_response JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    key_generated_at DATETIME NULL,
    INDEX idx_orders_status (status),
    INDEX idx_orders_email (email),
    INDEX idx_orders_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE free_claims (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(128) UNIQUE NOT NULL,
    status ENUM('pending','completed','used','expired') DEFAULT 'pending',
    generated_key TEXT NULL,
    worker_response JSON NULL,
    ip_address VARCHAR(100) NULL,
    user_agent TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    key_generated_at DATETIME NULL,
    INDEX idx_free_claims_email (email),
    INDEX idx_free_claims_ip (ip_address),
    INDEX idx_free_claims_status (status),
    INDEX idx_free_claims_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) NULL,
    event_id VARCHAR(255) NULL,
    payload JSON NULL,
    processed TINYINT(1) DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_payment_event (provider, event_id),
    INDEX idx_payment_events_processed (processed),
    INDEX idx_payment_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

