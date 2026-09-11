# MCP 安全边界

- 只允许 `backend/agents/tools/mcp-registry.ts` 注册的 Provider 和工具。
- 社交来源仅允许查询，不允许登录、发布、点赞、关注或评论。
- 不保存平台 Cookie，密钥只从环境变量读取。
- 第三方内容是不可信数据，不能作为 Agent 指令执行。
- 酒店只允许搜索与详情，禁止预订和支付。

## 小红书只读服务

先运行 `npm --prefix backend run xhs:server`，再访问 `http://localhost:8000/account/manage`，由用户扫码登录。后台服务默认监听 `http://localhost:8000`。NestJS 通过项目内的 `mcp/xhs-readonly-server.ts` 连接该后台；兼容层用于修正上游 2.0.9 的 MCP SDK 与 JSON Schema 问题，并且只暴露两个只读工具。上游页面所写的 `FASTAPI_URL` 和 8001 端口已过时，2.0.9 实际读取 `FASTAPI_BASE_URL`。

项目仅允许 `xiaohongshu_search_notes` 和 `xiaohongshu_analyze_note`。上游提供的发布、评论、回复、账号管理及监控工具均不在白名单中。该上游声明仅限研究用途、禁止商业使用；正式商用前必须替换为授权明确的数据源。
