CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `setting_value` JSON NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`setting_key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
