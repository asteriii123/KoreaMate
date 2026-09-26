# CLAUDE.md

本文件为 Claude Code 提供项目背景与约定。面向 AI 助手的架构说明见 [AGENTS.md](AGENTS.md)。

## 项目概述

KoreaMate V3 是面向中国赴韩自由行用户的 AI 旅行助手。Web 端只有两个一级入口：**AI 旅行规划** 与 **中韩翻译**。产品原则是"用最少的输入替用户完成理解、查询、比较、规划与调整"，而不是展示更多旅游信息。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js（`frontend/`，端口 3001） |
| 后端 | NestJS + Fastify（`backend/`，端口 3100，前缀 `/api/v1`） |
| 数据库 | PostgreSQL 17 + pgvector（Docker，端口 55432），Prisma 6 |
| 契约 | `shared/contracts/` 单一 Zod 契约，前后端共享 |
| LLM | 任意 OpenAI 兼容端点（`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`） |
| 向量 | `BAAI/bge-m3`（本地 Python 服务，1024 维） |
| 语音 | `faster-whisper`（本地） |
| OCR | PaddleOCR PP-OCRv5 韩文识别（本地 FastMCP） |
| 对象存储 | Cloudflare R2（图片资产，开发环境回退到本地目录） |

## 目录结构

```
frontend/            Next.js Web（app/ 页面 + components/ 组件）
backend/             NestJS + Fastify API
  prisma/            数据模型与迁移
  src/modules/       业务模块（travel / translation / places / memory / knowledge / …）
shared/contracts/    前后端共享 Zod 契约
infrastructure/      本地 Python 服务与 Docker
  paddleocr/         韩文 OCR（FastMCP，端口 58010）
  whisper/           语音转写（端口 58020）
  embedding/         BGE-M3 向量（端口 58030）
  docker-compose.yml PostgreSQL 与韩国旅游 MCP 容器
docs/                设计与 API 文档
```

## 常用命令

```bash
npm install                                              # 安装依赖（npm workspaces）
docker compose -f infrastructure/docker-compose.yml up -d postgres   # 启动数据库
npm run dev                                              # 启动 web + api + crewai
npm run dev:all                                          # 启动 web + api + crewai + ocr + whisper + embedding
npm run typecheck && npm run lint && npm test            # 质量检查
npm run test:integration -w @koreamate/api               # 集成测试（需真实 PostgreSQL）
```

## 约定

- **受控工作流，而非自治 Agent**：LLM 只负责自然语言理解、偏好提取、追问选择、推荐解释与回复生成；日期、金额、预算求和、天数校验、Schema 校验、重试和落库全部由普通 TypeScript 代码完成。
- **LLM 输出必须过 Zod 运行时校验**：所有结构化模型输出在进入业务逻辑前必须通过 `shared/contracts` 的 Schema；一次修复后仍无效则进入可重试失败态。
- **单源共享契约**：前后端类型与运行时校验都从 `shared/contracts/src/index.ts` 推导，不要在前端或后端各自重复定义接口。
- **Provider 降级，不伪造实时数据**：未配置或失败的天气/汇率/酒店/航班 Provider 必须明确降级，不得生成虚假价格、天气或库存。
- **模型不直接写业务表**：Controller 只处理 HTTP 边界，Application Service 执行业务用例，Provider 不修改行程，LLM 和 MCP 不直接写核心业务表。
- **秘密只写根目录 `.env`**：不要写入 `.env.example`、源码或聊天记录。

## 数据模型要点

- `Conversation → Message → Job → JobEvent`：会话、消息、异步任务与 SSE 事件。
- `Trip → TripRequirement → TripVersion → ItineraryDay → ItineraryItem`：行程需求、不可变版本、逐日逐项。
- `Place → PlaceSource`：规范化地点与多来源映射。
- `UserMemory`：五类长期偏好（出发城市 / 预算档 / 节奏 / 兴趣 / 限制）。
- `KnowledgeDocument → KnowledgeChunk → KnowledgeEmbedding`：RAG 知识库（官方事实 + 私人攻略，pgvector）。
- `ImageAsset`：图片翻译的原图/译图资产与处理状态。
