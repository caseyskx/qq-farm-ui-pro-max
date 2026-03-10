-- 为 accounts 表添加 avatar 列，用于存储用户头像 URL
-- 支持微信/QQ 扫码登录后显示真实头像

ALTER TABLE `accounts` ADD COLUMN `avatar` VARCHAR(512) NULL DEFAULT NULL AFTER `username`;
