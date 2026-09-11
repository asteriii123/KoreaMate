# 数据库

`backend/db/schema.prisma` 定义正式 PostgreSQL 数据模型。V0.1 默认使用内存仓储启动，便于零配置演示；数据库迁移与持久化仓储在设置 `DATABASE_URL` 后启用。
