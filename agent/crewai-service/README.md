# KoreaMate CrewAI Agent Service

Python CrewAI 多智能体服务。它负责理解统一对话、编排 Agent 和选择工具；业务数据、权限、事务和行程版本仍由 NestJS 领域工具 API 负责。

## 运行

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -e .
python -m app.api.server
```

环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`NESTJS_TOOL_API_URL`。
