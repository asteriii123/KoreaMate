# KoreaMate 架构

KoreaMate 使用 React 前端与 NestJS 模块化单体后端。后端业务目录直接位于 `backend/`，不使用额外的 `src` 或 `integrations` 层。

HTTP Controller 集中在 `api/`，业务逻辑集中在 `services/`。行程与媒体任务通过任务服务暴露状态和 SSE；Agent 及其 LLM/MCP 工具集中在 `agents/`。当前仓库提供无需密钥即可运行的本地 Provider，配置环境变量后再启用真实服务。
