-- 002-account-mode.sql
-- 账号模式功能：新增 account_mode / harvest_delay_min / harvest_delay_max 三列
-- 用于区分大号(main)、小号(alt)、风险规避(safe)模式

ALTER TABLE account_configs
ADD COLUMN account_mode VARCHAR(20) DEFAULT 'main' AFTER account_id;

ALTER TABLE account_configs
ADD COLUMN harvest_delay_min INT DEFAULT 180 AFTER account_mode;

ALTER TABLE account_configs
ADD COLUMN harvest_delay_max INT DEFAULT 300 AFTER harvest_delay_min;