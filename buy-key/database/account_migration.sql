CREATE TABLE IF NOT EXISTS customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NULL,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose ENUM('verify_email','reset_password','login_verify') NOT NULL DEFAULT 'verify_email',
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip_address VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_otps_email (email),
  INDEX idx_email_otps_customer_id (customer_id),
  INDEX idx_email_otps_purpose (purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER //

CREATE PROCEDURE add_column_if_missing(
  IN table_name_param VARCHAR(64),
  IN column_name_param VARCHAR(64),
  IN alter_sql_param TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_param
      AND COLUMN_NAME = column_name_param
  ) THEN
    SET @alter_sql = alter_sql_param;
    PREPARE stmt FROM @alter_sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_index_if_missing(
  IN table_name_param VARCHAR(64),
  IN index_name_param VARCHAR(64),
  IN alter_sql_param TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_param
      AND INDEX_NAME = index_name_param
  ) THEN
    SET @alter_sql = alter_sql_param;
    PREPARE stmt FROM @alter_sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_column_if_missing('orders', 'customer_id', 'ALTER TABLE orders ADD COLUMN customer_id BIGINT NULL AFTER id');
CALL add_index_if_missing('orders', 'idx_orders_customer_id', 'CREATE INDEX idx_orders_customer_id ON orders(customer_id)');
CALL add_index_if_missing('orders', 'idx_orders_email', 'CREATE INDEX idx_orders_email ON orders(email)');

CALL add_column_if_missing('free_claims', 'customer_id', 'ALTER TABLE free_claims ADD COLUMN customer_id BIGINT NULL AFTER id');
CALL add_index_if_missing('free_claims', 'idx_free_claims_customer_id', 'CREATE INDEX idx_free_claims_customer_id ON free_claims(customer_id)');
CALL add_index_if_missing('free_claims', 'idx_free_claims_email', 'CREATE INDEX idx_free_claims_email ON free_claims(email)');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
