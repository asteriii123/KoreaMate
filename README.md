# KoreaMate V3

面向低注意力成本用户的极简韩国旅行助手。Web 端只有两个核心入口：AI 旅行规划与中韩翻译。

## 项目结构

```text
frontend/           Next.js Web 前端
backend/            NestJS + Fastify API
shared/contracts/   前后端共享 Zod 契约
infrastructure/     PostgreSQL 与韩国旅游 MCP 容器
docs/superpowers/   V3 设计和实施文档
.env                本地真实配置，不会提交到 Git
```

## 配置 API Key

所有真实配置统一写在项目根目录的 `.env`：

```dotenv
LLM_API_KEY=你的模型Key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=你的模型名称

KAKAO_REST_API_KEY=你的Kakao_REST_API_Key
KOREA_TOURISM_API_KEY=你的韩国TourAPI_Key
KOREA_TOURISM_MCP_URL=http://localhost:58000/mcp
```

不要把 Key 写入 `.env.example`、源码或聊天记录。可通过下面的接口确认 Provider 是否已被识别：

```text
GET http://localhost:3100/api/v1/providers
```

## 本地启动

要求 Node.js 20+、npm 10+ 和 Docker Desktop。

```powershell
npm install
docker compose -f infrastructure/docker-compose.yml up -d postgres
npm run dev
```

默认地址：

- Web：<http://localhost:3001>
- API：<http://localhost:3100/api/v1>
- 健康检查：<http://localhost:3100/api/v1/health>

启用韩国旅游 MCP：

```powershell
docker compose --profile providers -f infrastructure/docker-compose.yml up -d korea-tourism-mcp
```

该服务需要先在韩国公共数据门户申请 `KOREA_TOURISM_API_KEY`。

## 质量检查

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

## 当前能力

- 中韩文字翻译、自然表达和发音提示
- 对话式旅行需求收集，支持简短上下文回答
- 结构化逐日行程、预算校验、不可变版本与恢复
- Kakao 地点 Provider
- 韩国 TourAPI MCP Provider
- Provider 状态、调用审计、地点来源和有效期

未配置的 Provider 会明确降级，不会生成伪造的实时数据。
