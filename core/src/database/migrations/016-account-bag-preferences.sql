CREATE TABLE IF NOT EXISTS `account_bag_preferences` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `account_id` INT NOT NULL,
    `purchase_memory` JSON DEFAULT NULL,
    `activity_history` JSON DEFAULT NULL,
    `plantable_seed_snapshot` JSON DEFAULT NULL,
    `mall_resolver_cache` JSON DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_account_bag_preferences_account_id` (`account_id`),
    CONSTRAINT `account_bag_preferences_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
