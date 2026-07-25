CREATE TABLE IF NOT EXISTS admin_users (
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化第一个管理员（用户ID 1），防止无人可添加管理员
INSERT IGNORE INTO admin_users (user_id) VALUES (1);
