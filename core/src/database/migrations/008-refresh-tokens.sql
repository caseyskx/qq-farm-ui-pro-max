CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `user_agent` VARCHAR(512) DEFAULT '',
    `ip_address` VARCHAR(45) DEFAULT '',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_rt_username` (`username`),
    INDEX `idx_rt_expires` (`expires_at`),
    CONSTRAINT `fk_rt_username` FOREIGN KEY (`username`) REFERENCES `users`(`username`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
