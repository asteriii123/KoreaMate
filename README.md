<div align="center">

# 🇰🇷 KoreaMate 3.0

### 一句话规划韩国行程，把菜单、招牌和对话翻译成真正能用的信息

KoreaMate 是面向中国赴韩自由行用户的 AI 旅行助手。它用对话补齐必要条件，结合真实地点、天气、汇率、航班与酒店信息生成逐日行程；在旅途中，还能完成文字、语音和图片内的中韩翻译。

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17%20%2B%20pgvector-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/Provider-MCP-6B46C1)](https://modelcontextprotocol.io/)

[产品理念](#为什么是-koreamate) · [核心能力](#核心能力) · [系统架构](#系统架构) · [快速开始](#快速开始) · [项目结构](#项目结构) · [设计亮点](#设计亮点)

</div>

---

## ✨ 为什么是 KoreaMate

做韩国自由行计划，难点通常不是“没有攻略”，而是信息太散：地点真假难辨、天气和交通不断变化、韩文菜单临场看不懂，改一次计划又要从头整理。

KoreaMate 把这些步骤收进一个连续的旅行工作流：

- 🧭 **一句话开始** — 直接说“国庆去首尔 5 天，两个人，想逛街和吃烤肉”，系统只在缺少关键条件时追问一个问题。
- 🗺️ **真实地点成行** — 景点和餐厅先经过 Kakao 或韩国旅游数据核验，再进入逐日行程，不让模型凭空编造 POI。
- 🌦️ **动态信息有出处** — 天气、汇率、航班、酒店与 AI 建议使用不同可信标签，实时数据不可用时明确降级。
- 🧠 **记住偏好，但不替你做主** — 长期记忆只补充本次没有说明的字段；当前对话中的明确要求始终优先。
- 🖼️ **把翻译放回原图** — 菜单和招牌经过本地 OCR 与翻译后，中文直接覆盖到原图相应位置。
- 🕘 **每次修改都可回退** — 修改行程会创建新的 `TripVersion`，旧版本不会被覆盖。

KoreaMate 3.0 不是把所有权力交给一个自治 Agent。系统由 NestJS 中的确定性代码编排，一个 OpenAI 兼容 LLM 在不同受控 Prompt 下完成需求整理、规划、翻译、记忆与攻略信息提取；数据访问、权限、事务、引用和版本管理始终留在领域服务中。

---

## 🖼️ 项目图集

从一句话开始，到真实地点、可控记忆和图片内翻译，六个画面概括 KoreaMate 3.0 的完整体验：

<p align="center">
  <img src="docs/readme-gallery.svg" alt="KoreaMate 3.0 六宫格产品图集：一句话规划、受控工作流、真实地点与行程、记忆由你掌控、图片内翻译、欢迎参与贡献" width="1100" />
</p>

> 这是仓库内可维护的产品信息图，不依赖外部图片链接；功能名称与数据边界以当前代码为准。

---

## 🎯 核心能力

### 1. 对话式旅行规划

- 从自然语言提取目的地、日期、天数、人数、预算、节奏、兴趣与限制
- 每次只追问一个最关键的缺失条件，避免把聊天变成表单
- 生成按天组织的行程，包含时段、地点、费用、推荐理由与地图入口
- 聚合最长 16 天的天气预报、CNY/KRW 汇率、航班与酒店上下文
- 支持自然语言局部修改，并为每次修改创建不可变的新版本
- 支持历史行程、地点收藏和“开始出发吧”旅行中视图

### 2. 文字、语音与图片翻译

- 自动识别中韩翻译方向
- 同时给出直译、自然表达、发音提示与礼貌程度
- 浏览器朗读韩文结果
- 语音输入通过本地 `faster-whisper` 转写
- 图片通过本地 PaddleOCR 识别，保留价格、杯型和英文等无需翻译的信息
- 翻译文字按 OCR 多边形重新排版到原图，低置信度内容单独提示

### 3. 长期偏好与个人知识

- 提取并保存五类偏好：出发城市、预算档、旅行节奏、兴趣、限制
- 合并顺序固定为：**本次明确输入 > 当前会话已确认需求 > 长期偏好 > 默认值**
- 用户可以查看、删除偏好，也可以在对话中要求“忘掉”某项记忆
- 游客内容按 `guestId` 隔离；登录后，偏好、收藏和对话可归并到用户账户
- 官方事实与用户导入攻略分库存储、分开召回，私人知识严格按所有者过滤

### 4. 攻略导入与核验

- 从攻略正文或截图提取具体地点
- 将提取结果逐个交给地点 Provider 核验
- 区分“已核验”和“待确认”，用户选择后再生成行程
- 链接无法读取时，明确提示上传截图或粘贴正文

---

## 🏗️ 系统架构

```text
Next.js Web
    │  HTTP + SSE
    ▼
NestJS / Fastify API
    ├── 对话编排 ──→ 意图判断 ──→ 旅行规划 / 翻译 / 通用回答
    │                      ├── 需求提取与单问题澄清
    │                      ├── 逐日行程生成
    │                      ├── 中韩翻译与 OCR 文字整理
    │                      ├── 长期偏好提取
    │                      └── 攻略地点提取
    ├── 领域服务 ──→ 行程版本 / 权限 / 收藏 / 记忆 / 引用 / 任务事件
    ├── Provider ──→ Kakao / 韩国旅游 MCP / Open-Meteo / Frankfurter
    │                Variflight MCP / RollingGo MCP
    └── 本地服务 ──→ PaddleOCR / faster-whisper / BGE-M3
                           │
                           ▼
               PostgreSQL 17 + pgvector
```

### 受控工作流，而不是自治系统

项目中的“规划器”“翻译器”“记忆提取器”和“攻略提取器”是同一个 OpenAI 兼容 LLM 在不同 Prompt 与结构化契约下承担的角色。NestJS 决定何时调用它们、可以使用哪些上下文，以及结果如何校验和落库。

这条边界带来四个明确保证：

1. 模型不能直接读写数据库或绕过用户身份边界。
2. 行程修改只能创建新版本，不能覆盖历史版本。
3. 引用统一由 `CitationFactory` 根据 Provider 记录生成，规划器不能自报来源。
4. 长期记忆只补缺失字段，不会覆盖当前旅行中用户明确说出的要求。

仓库保留了 `backend/crewai-service` 作为实验性的统一对话编排适配器。它同样只能通过 NestJS 的内部工具网关访问领域能力，不是业务数据与事务的所有者；默认的核心领域链路不依赖自治 Agent。

### Agent 调用流程

下面的流程图展示一次用户请求如何经过 Agent 工作流。Agent 只负责理解、路由和生成结构化结果；数据、权限、事务和版本始终由 NestJS 领域服务控制。

```mermaid
flowchart TD
    A[用户发送消息] --> B[ConversationService<br/>读取会话与身份]
    B --> C{Intent Router<br/>判断意图与动作}

    C -->|travel| D[旅行规划工作流]
    C -->|translation| E[翻译工作流]
    C -->|memory| F[记忆提取工作流]
    C -->|guide| G[攻略地点提取工作流]
    C -->|无法识别| H[规则降级 Intent Fallback]
    H --> C

    D --> D1{需求是否完整}
    D1 -->|否| D2[只追问一个关键问题]
    D1 -->|是| D3[查询真实地点与旅行上下文]
    D3 --> D4[生成逐日行程]
    D4 --> D5[创建新的 TripVersion]

    E --> E1{输入类型}
    E1 -->|文字| E2[LLM 中韩翻译]
    E1 -->|语音| E3[faster-whisper 转写]
    E1 -->|图片| E4[PaddleOCR 识别韩文与坐标]
    E4 --> E5[LLM 翻译 + Sharp 原图覆盖]
    E2 --> I
    E3 --> E2
    E5 --> I

    F --> F1[提取五类长期偏好]
    F1 --> F2[规则与置信度校验]
    F2 --> F3[只填充缺失字段]

    G --> G1[提取景点、餐厅与酒店]
    G1 --> G2[Kakao / 韩国旅游数据核验]
    G2 --> G3[输出已核验与待确认地点]

    D3 -.领域查询.-> T[NestJS Agent 工具网关]
    D5 -.领域写入.-> T
    F3 -.记忆管理.-> T
    G2 -.地点核验.-> T
    T --> P[Provider 与领域服务<br/>地点 / 天气 / 汇率 / 航班 / 酒店 / 数据库]

    D2 --> I[结构化结果与错误处理]
    F3 --> I
    G3 --> I
    P --> I
    I --> V[Zod Schema 校验]
    V --> S[保存 JobEvent / 会话 / 行程版本]
    S --> O[SSE 推送进度与结果]
    O --> U[前端展示]

    X[Agent 禁止直接访问数据库] -.安全边界.-> T
    X -.-> V
```

面试时可以概括为：**NestJS 决定流程和权限，LLM 负责自然语言任务，Provider 提供真实数据，Zod 负责结果校验，SSE 负责把持久化进度推给前端。**

### 技术栈

| 层 | 技术 |
| --- | --- |
| Web | Next.js 16、React 19、TypeScript |
| API | NestJS 12、Fastify |
| 数据库 | PostgreSQL 17、pgvector、Prisma 6 |
| 数据契约 | Zod 4，前后端共享 `shared/contracts` |
| LLM | 任意 OpenAI 兼容端点 |
| 地点 | Kakao REST、韩国旅游 MCP |
| 实时上下文 | Open-Meteo、Frankfurter、Variflight MCP、RollingGo MCP |
| OCR | PaddleOCR PP-OCRv5 韩文模型、FastMCP |
| 语音 | faster-whisper |
| 向量 | BAAI/bge-m3，1024 维 |
| 图片存储 | 开发环境本地目录；生产环境 Cloudflare R2 / S3 兼容存储 |

---

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- Python 3.11+（启用 OCR、语音、向量或实验编排服务时需要）
- Docker Desktop

### 1. 安装依赖

```bash
git clone <your-repository-url>
cd KoreaMate
npm install
```

### 2. 启动 PostgreSQL

```bash
docker compose -f infrastructure/docker-compose.yml up -d postgres
```

数据库映射到本机 `55432` 端口。镜像已包含 pgvector，迁移会创建知识检索所需的 `vector` 扩展。

### 3. 配置环境变量

```powershell
Copy-Item .env.example .env
```

最小可用配置：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/koreamate_v3
LLM_API_KEY=your_llm_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=your_model
KAKAO_REST_API_KEY=your_kakao_rest_key
```

按需启用其他能力：

```env
KOREA_TOURISM_API_KEY=
KOREA_TOURISM_MCP_URL=http://localhost:58000/mcp
FLIGHT_MCP_URL=
VARIFLIGHT_API_KEY=
HOTEL_MCP_URL=

PADDLEOCR_MCP_URL=http://127.0.0.1:58010/mcp
WHISPER_SERVICE_URL=http://127.0.0.1:58020
EMBEDDING_SERVICE_URL=http://127.0.0.1:58030
EMBEDDING_MODEL=BAAI/bge-m3
KNOWLEDGE_SEARCH_ENABLED=true

INTERNAL_API_KEY=replace-with-a-long-random-secret
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

> `.env.example` 只保留字段名和安全默认值。真实密钥只写入本地 `.env`，不要提交到 Git。

### 4. 初始化数据库

```bash
npm run prisma:generate -w @koreamate/api
npm run prisma:deploy -w @koreamate/api
```

本地开发新迁移时可将第二条命令换成 `npm run prisma:migrate -w @koreamate/api`。

### 5. 启动项目

```bash
npm run dev        # Web + API
npm run dev:all    # Web + API + OCR + Whisper + Embedding
```

启动后访问：

- Web：<http://localhost:3001>
- API：<http://localhost:3100/api/v1>
- 健康检查：<http://localhost:3100/api/v1/health>

### 6. 可选：启动韩国旅游 MCP

```bash
docker compose -f infrastructure/docker-compose.yml --profile providers up -d korea-tourism-mcp
```

### 7. 可选：启动实验性 CrewAI 适配器

仅在需要测试统一对话实验链路时启用：

```powershell
cd backend/crewai-service
python -m venv .venv
.\.venv\Scripts\pip install -e .
python -m app.api.server
```

对应环境变量见 [`backend/crewai-service/.env.example`](backend/crewai-service/.env.example)。服务默认监听 `http://127.0.0.1:8010`。

---

## 📁 项目结构

```text
KoreaMate/
├── frontend/                       # Next.js Web
│   ├── app/                        # 首页、规划、翻译、历史、收藏、出发模式
│   ├── components/                 # 对话、欢迎流程、图片翻译卡片、应用外壳
│   └── lib/                        # API 客户端、录音与语音合成
├── backend/
│   ├── prisma/                     # Prisma Schema 与数据库迁移
│   ├── src/
│   │   ├── agent/                  # 统一会话路由、运行记录与内部工具网关
│   │   ├── chat/                   # 会话与消息入口
│   │   ├── plan/                   # 需求整理、行程规划与外部上下文
│   │   ├── translate/              # 文本/图片翻译、OCR 与原图渲染
│   │   ├── place/                  # Kakao 与韩国旅游地点 Provider
│   │   ├── memory/                 # 长期偏好提取与管理
│   │   ├── knowledge/              # 官方事实、私人经验与向量检索
│   │   ├── citation/               # 统一引用生成
│   │   ├── saved/                  # 地点收藏
│   │   ├── speech/                 # 语音转写
│   │   ├── image/                  # 图片资产、所有者隔离与存储
│   │   ├── auth/                   # 邮箱验证码与游客归并
│   │   └── jobs/                   # 异步任务与 SSE 事件
│   └── crewai-service/             # 可选实验性统一对话适配器
├── shared/contracts/               # API、SSE 与领域对象的共享 Zod 契约
├── infrastructure/
│   ├── paddleocr/                  # 本地韩文 OCR 服务
│   ├── whisper/                    # 本地语音转写服务
│   ├── embedding/                  # 本地 BGE-M3 向量服务
│   └── docker-compose.yml          # PostgreSQL 与可选 Provider
└── docs/                            # API、功能说明、设计与实施记录
```

---

## 🔑 设计亮点

**1. 真实地点的封闭候选集**

规划器只能使用地点 Provider 返回并进入注册表的候选地点。模型负责排列组合，不负责发明地点。

**2. 不可变的行程版本**

每次修改都会创建新的 `TripVersion`，局部调整和历史恢复都围绕版本进行。

**3. 引用不交给模型生成**

`CitationFactory` 从实际 Provider 记录生成“已核验”“实时参考”和“小助理建议”三种状态，规划器不能把建议包装成实时事实。

**4. 长期记忆只负责补空白**

记忆只保存允许的五类偏好；本次明确输入拥有最高优先级，不会被长期记忆覆盖。

**5. 官方事实与私人经验分流**

Provider 内容和用户攻略分别检索、分别注入。私人知识在数据库查询阶段就按 `userId` 或 `guestId` 隔离。

**6. 图片翻译保持空间关系**

OCR 返回文字多边形，渲染器采样背景、覆盖原文字，并根据区域大小自动缩放、换行和居中。

**7. 本地媒体推理**

OCR、语音转写和向量生成均可在本地运行；生产图片存储可切换到 R2/S3 兼容服务。

**8. Provider 优雅降级**

天气、航班、酒店或汇率不可用时保留可完成的部分并展示降级状态，不伪造实时结果。

**9. 幂等消息与可恢复进度**

消息支持 `Idempotency-Key`；任务进度持久化为 `JobEvent` 并通过 SSE 推送。

**10. 前后端单一契约来源**

`shared/contracts` 用 Zod 定义请求、响应、SSE 事件、行程与 Provider 结果，减少接口漂移。

---

## 🧪 开发与验证

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

后端集成测试需要可用的测试数据库，可运行 `npm run test:integration`。接口说明见 [`docs/api.md`](docs/api.md)，图片翻译说明见 [`docs/image-translation.md`](docs/image-translation.md)。

---

## ⚠️ 项目边界

KoreaMate 是旅行规划与翻译助手，不是交易平台：当前版本不负责航班出票、酒店支付或签证办理，也不承诺第三方 Provider 数据永久可用。天气、价格、营业时间与交通信息可能发生变化，出发前请以服务商和场所官方信息为准。

---

## 📄 License

当前仓库未包含开源许可证文件。在对外分发或接受贡献前，请先补充明确的 License。
