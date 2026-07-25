-- 035_create_admin_users.sql
-- 用途：将管理员 ID 从 JSON 文件迁移到数据库表
-- 创建时间：2026-07-25
--
-- 兼容 MySQL 5.5：
-- - 不使用 JSON 列类型
-- - 仅一个 TIMESTAMP 列使用 DEFAULT CURRENT_TIMESTAMP

CREATE TABLE IF NOT EXISTS admin_users (
    user_id INT(11) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
