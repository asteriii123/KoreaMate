# KoreaMate V3 设计规格

状态：待用户最终审阅

日期：2026-09-14
目标：以现有代码为参考，从零建立面向低注意力成本用户的 KoreaMate V3 Web 产品。

## 1. 产品定义

KoreaMate V3 是面向中国赴韩自由行用户的 AI 旅行助手。产品不以展示更多旅游信息为目标，而是替用户完成理解、查询、比较、规划与调整。

核心承诺：

> 用户通过尽可能少的输入和点击，完成韩国旅行规划或韩语翻译。

V3 是可公开访问、能够调用真实 API 的个人 Web 项目，不承担企业级 SLA，也不在首版内完成航班出票、酒店支付或其他交易履约。

### 1.1 产品原则

1. 只有“旅行规划”和“AI 翻译”两个一级板块。
2. 一个页面只突出一个当前任务。
3. AI 每次最多追问一个最关键的问题。
4. 系统默认给出一个推荐，而不是把大量候选交给用户筛选。
5. 结果先展示结论，再按需展开原因、细节和来源。
6. 酒店、航班、天气、汇率、知识库与 Memory 是后台能力，不是前台频道。
7. 实时信息不可用时明确降级，不生成虚假价格、天气或库存。
8. 用户可查看和删除系统保存的长期偏好。

## 2. 范围

### 2.1 包含

- 聊天式韩国旅行需求收集与增量修改
- 韩国地点、活动、住宿区域和旅行知识检索
- 航班与酒店真实查询及外部跳转
- 天气、汇率和地图信息
- 按天行程、交通、预算、引用与版本历史
- 文字、图片 OCR、语音输入和韩文朗读
- 收藏、最近任务和可控用户 Memory
- RAG 知识检索与来源追踪
- MCP/REST Provider 接入、健康检查与降级
- 轻量内部 Provider、知识与任务诊断入口

### 2.2 不包含

- 站内出票、酒店下单、支付、退款和售后
- 攻略社区、关注、评论和内容发布
- 企业级多区域灾备与 SLA
- 面向普通用户的复杂运营后台
- 为每个外部工具建立独立自治 Agent

## 3. 前端信息架构

### 3.1 一级结构

```text
KoreaMate
├── 旅行规划
└── AI 翻译
```

不设置发现、酒店、航班、攻略、收藏或个人中心等一级导航。相关能力只在当前任务需要时出现。

### 3.2 首页

首页包含品牌、简短问题、两个大入口和最多一条最近任务：

```text
KoreaMate

今天需要我帮你做什么？

[帮我规划韩国旅行]
[帮我翻译韩语]

继续：首尔五日旅行
```

首页不得出现信息流、轮播图、功能宫格或多个竞争性行动按钮。

### 3.3 旅行规划

旅行页由对话与当前结果组成。桌面端可使用轻量双栏，移动端使用“对话/计划”两个上下文视图，但不形成全局导航。

支持：

- 一句话开始规划
- 每次一个必要追问
- 结构化需求摘要
- 自然语言局部修改
- 按天渐进式展示
- 航班、酒店、天气、预算与来源的上下文卡片
- 保存、分享和恢复历史版本

默认日程卡只展示地点顺序、节奏和费用摘要。时间、交通、原因、预约提示和来源按需展开。

主要操作不超过“调整、保存、分享”三个。换酒店、减少预算或重新规划等动作优先通过自然语言完成。

### 3.4 AI 翻译

翻译页使用一个多模态输入区域，自动识别文字、语音和图片，不要求用户选择翻译类型。

结果优先显示可直接给韩国人阅读的大号韩文，并提供播放与全屏展示。直译、自然表达、礼貌程度、发音和场景说明默认折叠。

### 3.5 交互和可访问性

- 移动优先，覆盖 375、768、1024 和 1440 像素视口。
- 触控目标至少 44×44 像素。
- 正文至少 16 像素，正文对比度不低于 4.5:1。
- 所有操作支持键盘和可见焦点。
- 使用 SVG 图标，不用 Emoji 代替功能图标。
- 保留浏览器返回、深链接和分享链接。
- 动效仅表达生成、切换和局部更新，并尊重 `prefers-reduced-motion`。

## 4. 系统架构

V3 采用 Next.js 与 NestJS 模块化单体：

```text
Next.js Web
      │ HTTPS + SSE
      ▼
NestJS API
      ├── Conversation
      ├── Travel
      ├── Translation
      ├── User / Memory
      ├── Knowledge
      ├── Provider Gateway
      └── Job Orchestrator
              ├── LLM
              ├── Korea Tourism MCP
              ├── Flight MCP
              ├── Hotel MCP
              ├── Weather MCP
              ├── Currency MCP
              ├── Map / Geocoding
              ├── OCR / Speech
              └── PostgreSQL / Storage
```

首版不建立独立 Python/CrewAI 服务。NestJS 是业务状态、任务状态、幂等与数据持久化的唯一权威入口。

## 5. AI 工作流

V3 使用受控工作流，而不是大量自治 Agent：

```text
用户消息
  → 意图与需求增量提取
  → 判断是否缺少关键条件
  → 每次追问一个问题，或生成查询计划
  → 并行调用必要 Provider
  → 结果标准化、去重与可信度处理
  → 构建候选路线
  → 生成行程
  → 确定性规则验证
  → LLM 审核与修订
  → 保存新版本并回复
```

LLM 负责自然语言理解、偏好提取、追问选择、推荐解释和回复生成。普通程序负责日期、金额、距离、耗时、营业冲突、预算求和、Schema 校验、重试和落库。

所有结构化模型输出必须经过运行时 Schema 校验。一次结构修复后仍无效时，任务进入可重试失败状态。

## 6. Provider 架构

外部服务通过项目自有领域接口接入：

```text
业务领域接口
  → Provider Registry
  → MCP Adapter / REST Adapter
  → 外部供应商
```

领域接口包括：

- `TourismProvider`
- `FlightProvider`
- `HotelProvider`
- `WeatherProvider`
- `CurrencyProvider`
- `GeocodingProvider`
- `ModelProvider`
- `TranslationProvider`
- `OcrProvider`
- `SpeechProvider`

每类能力最多配置一个首选 Provider 和一个可选备用 Provider。业务和 Planner 不依赖具体 MCP 的原始响应。

首批候选为 Korea Tourism MCP、RollingGo 航班、RollingGo 酒店、天气 MCP 与汇率 MCP。它们是候选而非锁定供应商；完成 API 申请、使用授权、真实联调、数据质量、限流和失败测试后才能启用生产配置。

### 6.1 降级规则

- 天气失败：继续规划并提示天气尚未确认。
- 航班失败：生成落地后行程，不展示虚假价格。
- 酒店失败：推荐住宿区域，不展示虚假库存或房价。
- 汇率失败：保留用户原币种，不使用未经标记的旧汇率。
- 地图失败：不声称准确交通时间，并降低路线可信度。
- MCP 超时：尝试一次备用 Provider；无备用则明确降级。

## 7. 后端模块

```text
apps/api/src/modules/
├── auth
├── users
├── conversations
├── uploads
├── travel
├── translation
├── memory
├── knowledge
├── providers
├── orchestration
├── jobs
└── health
```

Controller 只处理 HTTP 边界，Application Service 执行业务用例，Repository 和 Provider Interface 隔离 Prisma 与外部服务。Controller 不直接调用 Prisma，Provider 不修改行程，LLM 和 MCP 不直接写核心业务表。

## 8. 数据模型

### 8.1 关系

```text
User
├── Conversation ── Message ── Attachment
├── Trip ── TripRequirement
│       └── TripVersion ── ItineraryDay ── ItineraryItem
│       └── TripResource
├── Memory
├── SavedItem
└── Translation

Place ── PlaceSource
      └── KnowledgeDocument

ProviderCall ── Job
```

### 8.2 旅行需求

`TripRequirement` 支持目的城市、出发地、日期、天数、成人与儿童人数、预算及币种、是否包含机票、兴趣、节奏和自然语言约束。需求对象随消息增量更新。

字段完整度只用于内部决策。系统按当前用户意图判断是否追问，不将固定表单字段机械设为全部必填。

### 8.3 行程版本

行程修改创建新的 `TripVersion`，不得覆盖旧版本。局部修改只重新计算受影响的日期与关联预算，并保留恢复能力。

行程项目保存开始和结束时间、时区、地点 ID、坐标快照、活动类型、费用及币种、交通方式、耗时、推荐理由、预约提示和数据可信状态。

### 8.4 地点与来源

`Place` 是规范化地点实体，包含中韩名称、分类、城市、坐标、地址和状态。`PlaceSource` 保存 Provider、外部 ID、来源 URL、原始数据、抓取时间与过期时间。

地点使用稳定 ID 与多来源映射，不能仅保存 AI 生成的名称字符串。

### 8.5 动态旅行资源

航班、酒店、天气、汇率和旅游搜索结果作为 `TripResource` 快照保存，必须包含 Provider、查询条件、获取时间、过期时间与原始币种。旧价格和库存必须标记可能过期。

### 8.6 Memory

Memory 只保存对未来任务有帮助的偏好，并包含类型、键值、置信度、来源消息、状态和最后确认时间。状态支持启用、忽略和被新记忆取代。

密码、证件、支付信息和无必要的完整媒体不得进入 Memory。

### 8.7 翻译和媒体

翻译记录保存输入类型、语言、原文、译文、场景、礼貌程度、Provider 与可选附件引用。图片和音频默认采用临时保留策略，除非用户主动保存。

## 9. API 契约

API 使用 `/api/v1`，字段使用 `camelCase`，时间存 UTC，金额始终包含数值与 ISO 货币代码。

### 9.1 会话与消息

```http
POST /api/v1/conversations
POST /api/v1/conversations/{id}/messages
```

消息请求必须携带 `Idempotency-Key`，响应立即返回 `messageId`、`jobId` 和 `ACCEPTED` 状态。

### 9.2 上传

```http
POST /api/v1/uploads
```

客户端使用预签名地址直传对象存储，再通过 `attachmentId` 发送消息。大文件不得经 NestJS 内存中转。

### 9.3 任务事件

```http
GET /api/v1/jobs/{jobId}/events
Accept: text/event-stream
```

SSE 事件包含事件 ID、类型、发生时间和结构化数据，并支持 `Last-Event-ID` 断线恢复。前端只展示自然语言进度，不暴露内部 Agent 或 MCP 名称。

### 9.4 行程与保存内容

```http
GET    /api/v1/trips/{tripId}
POST   /api/v1/saved-items
GET    /api/v1/saved-items
DELETE /api/v1/saved-items/{id}
```

行程修改继续通过会话消息完成。对话工作流调用业务 Service，不允许模型直接写表。

### 9.5 标准错误

错误返回稳定代码、面向用户的消息、是否可重试和 `requestId`。堆栈、密钥与 Provider 原始错误只写入受控服务器日志。

## 10. 仓库结构

```text
KoreaMate/
├── apps/
│   ├── web/                         # Next.js
│   └── api/                         # NestJS + Prisma
├── packages/
│   └── contracts/                   # 共享运行时 Schema 和类型
├── mcp/                             # 第三方 MCP 配置与封装
├── infrastructure/
├── docs/
├── package.json
├── package-lock.json
└── .env.example
```

仓库使用 npm workspaces 和一份根锁文件。不引入独立 UI 包、微服务编排或额外构建系统，除非后续出现已验证需求。

`packages/contracts` 是 API、SSE、行程、需求、Provider 结果和错误的唯一共享契约来源。前后端类型由运行时 Schema 推导。

## 11. 测试策略

### 11.1 单元测试

覆盖需求合并、预算、日期、时区、路线冲突、版本变更、Provider 映射与 Memory 覆盖。

### 11.2 集成测试

使用真实 PostgreSQL 测试会话、消息、行程保存、版本、幂等与用户隔离。

### 11.3 Provider 契约测试

所有 Adapter 使用同一测试套件验证正常结果、空结果、超时、非法响应、来源、新鲜度和日志脱敏。CI 使用固定响应；真实 API 使用独立 smoke test，避免消耗配额。

### 11.4 端到端测试

必须覆盖：

1. 从首页一句话创建旅行。
2. AI 每次只追问一个问题。
3. 展示生成进度和行程。
4. 自然语言局部修改行程。
5. 中文转韩语并朗读。
6. 菜单图片 OCR 与翻译。
7. Provider 故障时可信降级。

## 12. 部署

```text
Vercel          → Next.js Web
Railway/Render  → NestJS API 与必要 MCP 容器
Supabase        → PostgreSQL 与对象存储
Upstash Redis   → 异步任务与限流，仅在接入任务队列时启用
```

环境分为 `local`、`preview` 和 `production`。没有 API Key 的能力必须显示未配置或降级状态，不得以 Mock 伪装成真实生产数据。

## 13. 现有代码处理

现有 `frontend`、`backend` 和用户未提交修改只作为参考。实施时：

1. 先记录 Git 状态并建立可恢复快照。
2. 新建 `apps/web`、`apps/api` 和 `packages/contracts`。
3. V3 不引用旧代码目录。
4. V3 核心流程验证后，再由用户确认是否移除旧目录。
5. 未经明确确认不得覆盖或删除用户未提交修改。

## 14. 验收标准

- 根目录一次安装成功。
- Web 与 API 可用一条开发命令启动。
- PostgreSQL 迁移可从空库重复执行。
- 前后端共享契约可编译并通过校验测试。
- 旅行规划和翻译核心路径端到端通过。
- 至少一个真实 MCP Provider 通过 smoke test。
- Provider 缺失或失败时提供明确降级结果。
- 行程局部修改生成新版本且可恢复。
- 构建、Lint、单元、集成与 E2E 测试全部通过。
- 旧代码及用户未提交修改没有丢失。

## 15. 实施分解

完整范围按统一契约分为可独立验收的增量：

1. 仓库骨架、共享契约与数据库基础。
2. 极简首页、会话与 SSE。
3. 文字翻译，再扩展 OCR、语音与朗读。
4. 旅行需求提取、基础行程与版本。
5. Korea Tourism、地图、天气和汇率 Provider。
6. 航班与酒店 Provider。
7. 知识检索、引用、收藏与 Memory。
8. 失败降级、可观测性、E2E 与公开部署。

每个增量必须保持可运行，不能等所有子系统完成后才进行首次集成。
