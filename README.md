<div align="center">

# ✈️ KoreaMate

### 一句话规划韩国行程，或完成韩语翻译

KoreaMate 是一个面向中国赴韩自由行用户的极简 AI 助手：对话式收集旅行需求、用真实 POI 生成可追踪的逐日行程，并以文字、语音、图片三种方式完成中韩互译。3.0 起，对话由 CrewAI 多智能体编排，而所有数据、权限与事务仍由 NestJS 领域服务掌控。

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![CrewAI](https://img.shields.io/badge/CrewAI-Multi--Agent-FF5A50)](https://crewai.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17%2Bpgvector-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-6B46C1)](https://modelcontextprotocol.io/)
[![Zod](https://img.shields.io/badge/Contracts-Zod-3E67B1)](https://zod.dev/)

[为什么是 KoreaMate](#为什么是-koreamate) · [核心能力](#核心能力) · [系统架构](#系统架构) · [快速开始](#快速开始) · [项目结构](#项目结构) · [设计亮点](#设计亮点)

</div>

---

## ✨ 为什么是 KoreaMate

大多数旅行工具把选择权推回给用户，让人在攻略和表单里反复筛选。KoreaMate 反过来：**默认给出一个推荐，只在缺少关键条件时追问一次**。

- 🧭 **只有两个入口** — 「帮我规划韩国旅行」和「帮我翻译韩语」，一个页面只突出一个任务。
- 🤖 **多智能体编排** — 对话由 CrewAI 的 7 个专职 Agent 协作完成理解、路由、规划与检索，Manager 层级委派。
- 💬 **先对话，再开跑** — 一句话开始，每次只追问一个最关键的问题，需求以结构化摘要持续累积。
- 🗺️ **真实地点与可执行行程** — 景点、餐厅来自 Kakao 与韩国旅游数据，结合天气、汇率、酒店、航班，逐日排布、预算求和、版本可恢复。
- 🧠 **长期旅行记忆** — 从对话中自动提取出发城市、预算、节奏、兴趣与限制，用户可随时查看、删除或用自然语言「忘掉」。
- 🖼️ **图片内翻译** — 菜单/招牌拍照后 OCR 识别韩文，直接在原图上覆盖中文，保留价格、杯型和英文，可切换原图、下载与分享。
- 🏷️ **来源可信状态** — 地点「已核验」、实时数据「实时参考」、AI 判断「小助理建议」，三者严格区分，不把猜测伪装成事实。
- ⚡ **异步任务 + 降级** — 消息幂等、SSE 进度推送；天气/汇率/酒店/航班不可用时明确降级，绝不生成伪造的实时数据。

所有景点与餐厅均来自真实 Provider；长期偏好具有来源与置信度，不会在用户不知情的情况下静默覆盖当前需求。

---

<a id="核心能力"></a>

## 🎯 核心能力

### 1. AI 旅行规划

- 一句话开始，逐轮补齐目的地、日期、天数、人数、预算与偏好
- 结构化逐日行程：时间、费用、推荐理由、地图入口
- 天气（16 天预报）、汇率（CNY/KRW）、酒店、航班上下文卡片
- 自然语言局部修改，每次生成**不可变新版本**，可恢复历史版本
- 小红书攻略导入：链接/截图 → 提取地点 → Kakao 核验 → 一键生成行程
- 地点收藏、历史记录、「开始出发吧」出发模式

### 2. AI 翻译

- 自动识别中/韩方向，输出大字韩文可朗读（浏览器 TTS）
- 直译、自然表达、发音提示、礼貌程度分层展示
- **语音输入**（本地 faster-whisper 转写）
- **图片翻译**（本地 PaddleOCR 韩文识别 + 原图中文覆盖）
- 菜单分类整理：菜名、原名、价格，低置信度区域虚线标注

### 3. 长期偏好与身份

- 五类长期偏好：出发城市、预算档、节奏、兴趣、限制
- 邮箱验证码登录；游客数据登录后自动归并到账户
- 「我的偏好」账户面板逐项删除

---

<a id="系统架构"></a>

## 🏗️ 系统架构

```
用户消息 ──→ [统一会话入口] ──→ UNIFIED 模式？
   │                                │ 是
   │                                ▼
   │                   [CrewAI 多智能体服务]（Python，端口 8010）
   │                      │  Manager 层级委派到 7 个 Agent
   │                      │  context_manager / intent_router / travel_planner /
   │                      │  translation / research / memory / verifier
   │                      │
   │                      ▼  Agent 需要真实数据时
   │                   [NestJS Agent 工具网关]（/internal/agent-tools/*）
   │                      │  地点 / 天气 / 航班 / 酒店 / 记忆 / 收藏 / 建改行程 / 翻译
   │                      ▼
   │                   [NestJS 领域服务 + 数据库]
   │
   └── 图片翻译 / 行程卡片等确定性任务 ──→ 专用领域链路（OCR + 渲染 / 领域规划器）
```

**两层分工**：CrewAI（Python）负责自然语言理解、意图路由、工具选择与 Agent 协作；NestJS 负责数据、权限、事务、行程版本与落库。Agent 从不直接访问数据库，一切写操作都通过工具网关回落到领域服务。

**技术栈**

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16 |
| 后端 | NestJS 12 + Fastify |
| 多智能体 | CrewAI（Python 3.11，hierarchical 7-Agent） |
| 数据库 | PostgreSQL 17 + pgvector，Prisma 6 |
| 契约 | 前后端共享 Zod（`shared/contracts`） |
| LLM | OpenAI 兼容端点（DeepSeek 等） |
| 向量 | BAAI/bge-m3（本地，1024 维） |
| OCR | PaddleOCR PP-OCRv5 韩文识别（本地 FastMCP） |
| 语音 | faster-whisper（本地） |
| 对象存储 | Cloudflare R2（图片资产，开发环境回退本地目录） |

---

<a id="快速开始"></a>

## 🚀 快速开始

要求 Node.js 20+、npm 10+、Python 3.11+ 和 Docker Desktop。

### 1. 安装依赖

```bash
npm install
```

### 2. 启动数据库

```bash
docker compose -f infrastructure/docker-compose.yml up -d postgres
```

本地 PostgreSQL 使用带 `pgvector` 的 PostgreSQL 17 镜像，知识库迁移会自动创建 `vector` 扩展。

### 3. 配置环境变量

复制 `.env.example` 为根目录 `.env`，填入 API Key：

```env
# LLM（规划 / 翻译 / 记忆提取 / 攻略导入 / 意图路由）
LLM_API_KEY=your_llm_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=your_model

# CrewAI 多智能体（复用 OpenAI 兼容端点）
OPENAI_API_KEY=your_llm_key
OPENAI_BASE_URL=https://api.openai.com/v1
CREWAI_MODEL_NAME=your_model

# 地点 Provider
KAKAO_REST_API_KEY=your_kakao_key
KOREA_TOURISM_API_KEY=your_tourism_key
KOREA_TOURISM_MCP_URL=http://localhost:58000/mcp

# 航班 / 酒店 MCP（可选，未配置则降级）
FLIGHT_MCP_URL=
VARIFLIGHT_API_KEY=
HOTEL_MCP_URL=

# 本地媒体服务
PADDLEOCR_MCP_URL=http://127.0.0.1:45010/mcp
WHISPER_SERVICE_URL=http://127.0.0.1:45020
EMBEDDING_SERVICE_URL=http://127.0.0.1:45030
```

> 秘密只写 `.env`，不要写入 `.env.example` 或源码。可通过 `GET /api/v1/providers` 查看 Provider 配置状态。

### 4. 启动 Web / API / 本地媒体服务

```bash
npm run dev        # 启动 web + api
# 或
npm run dev:all    # 启动 web + api + ocr + whisper + embedding
```

### 5. 启动 CrewAI 多智能体服务（UNIFIED 对话需要）

```bash
cd backend/crewai-service
python -m venv .venv
.\.venv\Scripts\pip install -e .
python -m app.api.server
```

打开浏览器访问：

- Web：<http://localhost:3001>
- API：<http://localhost:3100/api/v1>
- CrewAI 服务：<http://localhost:8010/health>
- 健康检查：<http://localhost:3100/api/v1/health>

---

<a id="项目结构"></a>

## 📁 项目结构

```
├── frontend/               # Next.js Web
│   ├── app/                # 首页 / 旅行规划 / 翻译 / 历史 / 收藏 / 出发
│   ├── components/         # 对话屏、图片翻译卡片、欢迎流程、App 外壳
│   └── lib/                # API 客户端、录音、语音合成
├── backend/                # NestJS + Fastify API
│   ├── prisma/             # 数据模型与迁移
│   ├── src/agent/          # Agent 模块：编排器、CrewAI 桥接、工具网关、流式、运行记录
│   ├── src/                # 其余领域模块：chat / plan / translate / place /
│   │                       # memory / knowledge / image / speech / auth / …
│   └── crewai-service/     # Python CrewAI 多智能体服务（7 个 Agent）
│       ├── app/agents/     #   Agent 定义
│       ├── app/flows/      #   Crew 编排流程
│       └── app/tools/      #   NestJS 工具回调
├── shared/contracts/       # 前后端共享 Zod 契约（单一契约来源）
├── infrastructure/         # 本地 Python 服务与 Docker
│   ├── paddleocr/          # 韩文 OCR（FastMCP）
│   ├── whisper/            # 语音转写
│   ├── embedding/          # BGE-M3 向量
│   └── docker-compose.yml
└── docs/                   # 设计与 API 文档
```

---

<a id="设计亮点"></a>

## 🔑 设计亮点

**1. 多智能体编排，领域边界受控**
对话由 CrewAI 的 7 个专职 Agent 协作完成，Manager（intent_router）层级委派。但 Agent 只负责理解、路由、选工具与生成回复，**数据、权限、事务、行程版本仍由 NestJS 领域服务掌控**——把多智能体的灵活性，架在确定性代码的可信边界上。

**2. Agent 工具网关，绝不直接碰库**
9 个领域工具（地点 / 天气 / 航班 / 酒店 / 记忆 / 收藏 / 建改行程 / 翻译）统一通过 HTTP 回调 NestJS `/internal/agent-tools/*`。Agent 无状态、无数据库连接，只能请求领域服务代为执行写操作。

**3. 统一会话路由 + 专用领域链路**
`UNIFIED` 模式统一入口，由意图路由决定追问、规划、翻译还是推荐；图片翻译、行程卡片等需要确定性结果的任务，仍走专用领域链路（PaddleOCR + Sharp / 领域规划器），不经过 Agent。

**4. 真 token 流式 + SSE 恢复**
最终回复用 `stream: true` 逐 token 推送 `agent.reply.delta`，SSE 断线自动恢复；流式失败自动回退为整段输出。

**5. 每次只追问一个最关键的问题**
需求字段完整度只用于内部决策；系统按当前意图判断是否追问，不把固定表单机械设为全部必填。简短回答（如「3」「成都」）会被 pendingField 上下文正确解释。

**6. 不可变行程版本**
每次修改创建新 `TripVersion`，绝不覆盖旧版本；局部修改只重算受影响的日期与预算，历史版本可一键恢复。

**7. 三级可信状态**
`CitationFactory` 统一生成引用：地点「已核验 · Kakao」、天气汇率酒店航班「实时参考」、行程安排「小助理建议」。引用由普通代码从 Provider 记录生成，Planner 不得伪造来源；只允许 HTTPS 来源链接。

**8. 长期偏好 Memory**
LLM + 规则双通道异步提取五类偏好，置信度 ≥ 0.8 才保存；规划时按「本次输入 > 已确认需求 > 长期偏好 > 默认值」合并，只填缺失字段。游客登录后偏好与收藏、对话在同一事务中归并。

**9. RAG 知识检索**
地点 Provider 命中后自动转为「官方事实」知识文档，用户导入的攻略转为「私人经验」，用本地 BGE-M3 生成 1024 维向量存入 pgvector。两类内容分开检索、分别注入，事实可直接引用、经验只能作为建议表达。

**10. 图片内翻译**
PaddleOCR 返回每行文字的 `lineId`、置信度与四点多边形，LLM 只翻译韩文（保留价格/杯型/英文），Sharp 按多边形采样背景色覆盖原文字、自动缩放换行居中，低置信度区域虚线标注。单张失败不影响同批其他图片。

**11. 全本地媒体推理**
语音（faster-whisper）、OCR（PaddleOCR）、向量（BGE-M3）都在本地 Python 服务运行，不依赖付费云端媒体 API；OCR 服务启动时预热模型，避免首次请求冷启动超时。

**12. Provider 优雅降级**
天气失败继续规划、航班失败生成落地后行程、酒店失败推荐住宿区域、汇率失败保留原币种、MCP 超时尝试备用 Provider。未配置的 Provider 明确降级，不生成伪造实时数据。

**13. 幂等 + SSE 任务事件**
消息请求携带 `Idempotency-Key`，重复提交返回同一任务；后端通过持久化 `JobEvent` 以 SSE 推送进度，前端只展示自然语言进度，不暴露内部 Agent/MCP 名称。

**14. 攻略导入 → 核验 → 成行**
小红书链接或截图经 LLM 提取具体地点后，逐个用 Kakao 核验（「已核验 / 待确认」），用户勾选后一键生成行程；不能读取的链接回退为「请上传截图或粘贴正文」。

**15. 单源共享契约**
`shared/contracts` 是 API、SSE、行程、需求、Provider 结果、引用与错误的唯一契约来源，前后端类型与运行时校验都从同一份 Zod Schema 推导。

---

## 📄 说明

本项目是可公开访问的个人 Web 项目，不承担企业级 SLA，也不在首版内完成航班出票、酒店支付或其他交易履约。Open-Meteo、Frankfurter 等开放接口适合本地开发与原型，公开商业服务应切换至商业套餐或已授权 Provider。
