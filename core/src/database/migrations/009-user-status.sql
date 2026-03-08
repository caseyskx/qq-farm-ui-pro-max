ALTER TABLE `users`
ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `role`;

UPDATE `users`
SET `status` = 'active'
WHERE `status` IS NULL OR `status` = '';
