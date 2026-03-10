CREATE TABLE IF NOT EXISTS `admin_operation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `client_id` VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `actor_username` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `scope` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
    `action_label` VARCHAR(120) COLLATE utf8mb4_unicode_ci NOT NULL,
    `status` VARCHAR(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
    `total_count` INT NOT NULL DEFAULT '1',
    `success_count` INT NOT NULL DEFAULT '1',
    `failed_count` INT NOT NULL DEFAULT '0',
    `affected_names` JSON DEFAULT NULL,
    `failed_names` JSON DEFAULT NULL,
    `detail_lines` JSON DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_admin_operation_logs_actor_scope_client` (`actor_username`, `scope`, `client_id`),
    KEY `idx_admin_operation_logs_scope_created` (`scope`, `created_at`),
    KEY `idx_admin_operation_logs_actor_scope_created` (`actor_username`, `scope`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
