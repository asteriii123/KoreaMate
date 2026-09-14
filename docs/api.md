# KoreaMate V3 API

基础地址：`http://localhost:3100/api/v1`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | API 健康检查 |
| `POST` | `/conversations` | 创建旅行规划或翻译会话 |
| `POST` | `/conversations/:id/messages` | 发送文字消息，需要 `idempotency-key` 请求头 |
| `GET` | `/jobs/:id/events` | 订阅持久化 SSE 任务事件 |
| `POST` | `/trips/:tripId/versions/:versionId/restore` | 将历史行程恢复为一个新版本 |
| `GET` | `/providers` | 查看外部 Provider 是否完成配置 |
| `GET` | `/places/search?query=...&provider=...` | 搜索并保存标准化韩国地点 |

请求与响应的运行时 Schema 位于 `packages/contracts/src/index.ts`。API Key 只写入根目录 `.env`。
