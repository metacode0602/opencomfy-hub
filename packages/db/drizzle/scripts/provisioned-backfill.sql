-- 历史账号 provisioned_by 回填（部署后按需执行，见 auth-closed-registration-password-policy.md §9.2）
-- 执行前须已运行 0003_users_provisioned.sql

-- 全量回填：将 BOOTSTRAP_ADMIN_USER_ID 替换为实际管理员 users.id
-- UPDATE users
-- SET provisioned_by = 'BOOTSTRAP_ADMIN_USER_ID',
--     provisioned_at = COALESCE(created_at, NOW())
-- WHERE provisioned_by IS NULL;

-- 部分回填（仅 role = admin，自引用）
-- UPDATE users
-- SET provisioned_by = id,
--     provisioned_at = COALESCE(created_at, NOW())
-- WHERE provisioned_by IS NULL AND role = 'admin';
