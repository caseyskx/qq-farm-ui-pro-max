-- 卡密精细化管理增强
-- 注意：cards 表字段补齐由 mysql-db.js 按列检测后执行，
-- 这里仅保留可跨版本兼容的建表语句，避免部分 MySQL/MariaDB 因
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS 语法差异导致启动失败。

CREATE TABLE IF NOT EXISTS `card_operation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `card_id` INT DEFAULT NULL,
    `card_code` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `action` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `operator` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `target_username` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `remark` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `before_snapshot` JSON DEFAULT NULL,
    `after_snapshot` JSON DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_card_operation_logs_card_code` (`card_code`),
    KEY `idx_card_operation_logs_action_created` (`action`, `created_at`),
    KEY `idx_card_operation_logs_target_created` (`target_username`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
