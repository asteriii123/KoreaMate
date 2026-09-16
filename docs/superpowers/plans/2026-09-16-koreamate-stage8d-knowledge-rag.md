# KoreaMate 第八阶段 8D：旅游知识库与 RAG 实施计划

## 目标

交付一个可本地运行、可测试、可降级的中韩文旅游知识检索闭环：公共地点事实与当前用户私人攻略分别入库，使用魔搭 `BAAI/bge-m3` 生成 1024 维向量，通过 PostgreSQL `pgvector` 检索，并以两个独立上下文数组接入旅行 Planner。

## 实施原则

- 先建立可验证的数据边界，再接入 Planner。
- 私人知识必须在 SQL 查询条件中按身份隔离。
- RAG 是增强能力，任何故障都不得阻塞基础规划与翻译。
- 第一版只使用 dense embedding，不引入 reranker、sparse 或 ColBERT。
- 每个任务完成后提交一个小型 Git commit。
- 模型文件和用户内容不得提交到 Git。

## 任务 1：pgvector 本地基础设施

### 修改文件

- `infrastructure/docker-compose.yml`
- `.env.example`
- `README.md`（若项目已有运行说明；没有则新增 `infrastructure/embedding/README.md`）

### 步骤

1. 将 PostgreSQL 镜像替换为兼容 PostgreSQL 17 的 pgvector 镜像。
2. 保留现有数据库端口、卷名和健康检查，避免破坏本地数据连接。
3. 在数据库迁移中使用 `CREATE EXTENSION IF NOT EXISTS vector`，而不是依赖人工执行。
4. 在 `.env.example` 增加：
   - `EMBEDDING_SERVICE_URL=http://127.0.0.1:58030`
   - `EMBEDDING_MODEL=BAAI/bge-m3`
   - `EMBEDDING_MODEL_VERSION`
   - `KNOWLEDGE_SEARCH_ENABLED=true`
5. 文档说明模型免费，但服务器计算资源可能收费。

### 验证

```powershell
docker compose -f infrastructure/docker-compose.yml config
docker compose -f infrastructure/docker-compose.yml up -d postgres
docker compose -f infrastructure/docker-compose.yml exec postgres psql -U postgres -d koreamate_v3 -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname='vector';"
```

### 提交

```text
chore: enable pgvector infrastructure
```

## 任务 2：BGE-M3 Embedding 服务

### 新增文件

- `infrastructure/embedding/server.py`
- `infrastructure/embedding/requirements.txt`
- `infrastructure/embedding/README.md`
- `infrastructure/embedding/server_test.py`

### 修改文件

- `package.json`
- `.gitignore`

### 步骤

1. 使用与 Whisper/PaddleOCR 一致的轻量 HTTP 服务结构。
2. 通过 ModelScope `snapshot_download` 下载 `BAAI/bge-m3` 至外部缓存目录。
3. 使用 `FlagEmbedding` 加载模型；CPU 默认关闭 fp16，CUDA 可启用 fp16。
4. 实现 `GET /health`，返回：
   - `status`
   - `model`
   - `modelVersion`
   - `dimensions=1024`
   - `device`
5. 实现 `POST /embed`：
   - 输入 `{ texts: string[] }`
   - 每批最多 32 条
   - 单条最多 4096 个字符
   - 输出归一化 dense vectors
6. 对空文本、超量批次、错误维度返回明确 4xx/5xx。
7. 增加 `npm run dev:embedding`，并将其加入 `dev:all`。
8. 将虚拟环境、模型缓存和测试缓存加入 `.gitignore`。

### 测试

- 健康检查返回正确模型和维度。
- 中文与对应韩文地点文本的相似度高于无关文本。
- 输入限制生效。
- 模型未加载时返回不可用状态，不返回伪向量。

### 验证

```powershell
python -m unittest infrastructure/embedding/server_test.py
npm run dev:embedding
```

### 提交

```text
feat: add local bge m3 embedding service
```

## 任务 3：共享知识契约

### 修改文件

- `shared/contracts/src/index.ts`
- `shared/contracts/src/index.test.ts`

### 步骤

1. 新增 `KnowledgeKindSchema`：`official_fact | personal_experience`。
2. 新增 Planner 使用的 `KnowledgeReferenceSchema`：
   - `chunkId`
   - `kind`
   - `title`
   - `content`
   - `provider`
   - `sourceUrl`
   - `fetchedAt`
   - `expiresAt`
   - `stale`
   - `score`
3. 新增 `TravelKnowledgeContextSchema`：
   - `officialFacts`
   - `personalExperiences`
4. 每类限制最大条数和单条内容长度，防止提示词膨胀。
5. 外部链接继续只允许 HTTPS；私人经验允许 `sourceUrl=null`。

### 测试

- 拒绝未知知识类型。
- 拒绝超过长度和数量限制的数据。
- 私人经验不能声明 `verified` 状态。
- 官方事实必须包含 Provider 与抓取时间。

### 验证

```powershell
npm test -w @koreamate/contracts
npm run typecheck
```

### 提交

```text
feat: define travel knowledge contracts
```

## 任务 4：知识数据库模型与迁移

### 修改文件

- `backend/prisma/schema.prisma`

### 新增文件

- `backend/prisma/migrations/20260916210000_knowledge_rag/migration.sql`

### 步骤

1. 新增 Prisma 枚举：
   - `KnowledgeKind`
   - `KnowledgeVisibility`
   - `KnowledgeStatus`
   - `EmbeddingStatus`
2. 新增 `KnowledgeDocument`、`KnowledgeChunk`、`KnowledgeEmbedding`。
3. `KnowledgeDocument` 分别关联可空的 `User`、`GuestIdentity`、`PlaceSource` 和 `TripResource`。
4. 添加约束，确保：
   - `public` 文档没有用户归属。
   - `private` 文档恰好有一个 `userId` 或 `guestId`。
5. 使用 `Unsupported("vector(1024)")` 映射向量列。
6. SQL 迁移创建 vector 扩展及 HNSW cosine 索引。
7. 添加去重索引：
   - 公共来源 Provider + externalId。
   - 私人所有者 + contentHash。
8. 级联删除 Document → Chunk → Embedding。

### 验证

```powershell
npm run prisma:generate -w @koreamate/api
npm run prisma:migrate -w @koreamate/api
npm run typecheck
```

额外执行 SQL，确认 vector 扩展、列维度和 HNSW 索引存在。

### 提交

```text
feat: add knowledge vector schema
```

## 任务 5：EmbeddingClient 与健康状态

### 新增文件

- `backend/src/modules/knowledge/embedding.client.ts`
- `backend/src/modules/knowledge/embedding.client.test.ts`
- `backend/src/modules/knowledge/knowledge.module.ts`

### 修改文件

- `backend/src/app.module.ts`
- `backend/src/modules/health/health.controller.ts`

### 步骤

1. 实现 `EmbeddingClient.health()` 和 `EmbeddingClient.embed(texts)`。
2. 启动时验证服务模型、版本和维度。
3. 设置连接超时与请求超时，不进行请求内无限重试。
4. 严格验证向量数量、数值有限性和 1024 维长度。
5. `KNOWLEDGE_SEARCH_ENABLED=false` 或 URL 缺失时进入显式禁用状态。
6. 健康接口增加 `knowledgeEmbedding` 状态，但不暴露内部地址或密钥。

### 测试

- 正常响应被解析。
- 维度不符、NaN、数量不符时拒绝写入。
- 超时与服务错误转换为稳定错误码。
- 禁用时不发送网络请求。

### 验证

```powershell
npm test -w @koreamate/api -- embedding.client.test.ts
npm run typecheck
npm run lint
```

### 提交

```text
feat: connect local embedding service
```

## 任务 6：公共地点知识入库

### 新增文件

- `backend/src/modules/knowledge/knowledge-ingestion.service.ts`
- `backend/src/modules/knowledge/knowledge-ingestion.service.test.ts`
- `backend/src/modules/knowledge/knowledge-text.ts`

### 修改文件

- `backend/src/modules/places/places.module.ts`
- `backend/src/modules/places/places.service.ts`

### 步骤

1. 将地点规范化为稳定文本，明确包含韩文名、中文名、地址、分类和来源。
2. 使用 SHA-256 生成内容哈希。
3. `PlacesService.persist` 完成来源 upsert 后调用公共知识同步。
4. 内容不变时只刷新来源时间与有效期。
5. 内容变化时事务更新 Document/Chunk，并将 Embedding 标记为 pending。
6. 第一版在当前进程异步生成向量；失败只记录状态，不回滚地点搜索结果。
7. 使用参数化原生 SQL 写入 vector 列。

### 测试

- 相同地点重复搜索不创建重复知识。
- 内容变化触发新向量。
- Embedding 服务故障不影响地点搜索。
- 官方知识没有用户归属。

### 验证

```powershell
npm test -w @koreamate/api -- knowledge-ingestion.service.test.ts
npm run test:integration
```

### 提交

```text
feat: ingest verified place knowledge
```

## 任务 7：私人攻略知识入库与身份迁移

### 修改文件

- `backend/src/modules/travel/guide-import.service.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/identity.service.ts`
- `backend/src/modules/knowledge/knowledge-ingestion.service.ts`

### 新增文件

- `backend/test/knowledge-privacy.integration.test.ts`

### 步骤

1. GuideImport 读取 Trip → Conversation，取得当前 `userId` 或 `guestId`。
2. 保存经过长度限制的用户笔记、页面清洗文本和解析地点；不保存页面脚本与样式。
3. 以主题/自然段切分私人攻略，不把不同地点强行合并。
4. 私人文档必须带唯一身份归属。
5. 生成内容哈希，防止同一用户重复导入。
6. 登录合并事务中迁移 Guest 的私人 KnowledgeDocument 至 User。
7. 冲突时按内容哈希合并，删除重复文档。
8. 为后续删除能力提供事务方法，级联清理 Chunk 和 Embedding。

### 测试

- 用户 A 和 B 导入相同链接仍生成各自私有文档。
- 用户 A 无法查询用户 B 文档。
- 游客登录后文档归属正确迁移。
- 重复导入不会产生重复 Chunk。
- 删除文档后向量不可查询。

### 验证

```powershell
npm run test:integration -w @koreamate/api -- knowledge-privacy.integration.test.ts
npm run typecheck
```

### 提交

```text
feat: store private guide knowledge
```

## 任务 8：向量检索服务

### 新增文件

- `backend/src/modules/knowledge/knowledge-search.service.ts`
- `backend/src/modules/knowledge/knowledge-search.service.test.ts`

### 步骤

1. 对查询文本生成一次向量。
2. 使用参数化 SQL 分别查询：
   - 公共 `official_fact`。
   - 当前身份的 `personal_experience`。
3. 使用 cosine distance，并把距离转换为可解释 score。
4. 在 SQL 层应用身份条件、当前模型版本和 ready 状态。
5. 对过期来源降低分数并设置 `stale=true`。
6. 每类独立 Top-K，之后按地点与内容哈希去重。
7. 返回 `TravelKnowledgeContextSchema`。
8. 服务不可用或无合格结果时返回两个空数组，不抛出规划级错误。

### 测试

- 中文查询召回韩文地点 fixture。
- 私人查询包含所有者 SQL 条件。
- 官方和私人结果不会互相占用 Top-K。
- 低于阈值的结果不返回。
- 过期内容降权并标记 stale。
- Embedding/数据库异常返回空上下文。

### 验证

```powershell
npm test -w @koreamate/api -- knowledge-search.service.test.ts
npm run test:integration
```

### 提交

```text
feat: retrieve isolated travel knowledge
```

## 任务 9：Planner 接入知识上下文

### 修改文件

- `backend/src/modules/travel/travel-provider.ts`
- `backend/src/modules/travel/openai-compatible-travel.provider.ts`
- `backend/src/modules/travel/openai-compatible-travel.provider.test.ts`
- `backend/src/modules/travel/travel.service.ts`
- `backend/src/modules/travel/travel.module.ts`

### 步骤

1. 在 `TravelProvider.plan` 输入中增加可选 `knowledge`。
2. `TravelService` 在需求合并后、调用 Planner 前执行知识检索。
3. 只传递合同允许的少量字段，不传数据库内部标识和完整原文。
4. System Prompt 明确：
   - `officialFacts` 可作为事实，但动态字段仍需实时 Provider。
   - `personalExperiences` 只能作为建议，使用“小助理建议”语气。
   - 不得把私人经验称为“已核验”。
5. 知识检索失败时传入空上下文并继续规划。
6. 不因 RAG 内容改变现有一问一答需求收集逻辑。

### 测试

- Provider 收到分离的官方和私人数组。
- Prompt 包含可信语义约束。
- 无知识时输出结构不变。
- 检索失败仍能返回基础行程。
- 现有短回答上下文测试继续通过。

### 验证

```powershell
npm test -w @koreamate/api -- openai-compatible-travel.provider.test.ts context-answer.test.ts
npm run typecheck
npm run lint
```

### 提交

```text
feat: ground planner with travel knowledge
```

## 任务 10：诊断、回填与全量验收

### 新增文件

- `backend/src/modules/knowledge/knowledge.controller.ts`
- `backend/src/modules/knowledge/knowledge-backfill.service.ts`
- `backend/src/modules/knowledge/knowledge-backfill.service.test.ts`

### 修改文件

- `backend/src/modules/knowledge/knowledge.module.ts`
- `backend/src/modules/health/health.controller.ts`
- `README.md` 或 `infrastructure/embedding/README.md`

### 步骤

1. 增加受限的内部知识状态接口，只返回数量和状态：
   - ready/pending/failed 文档数
   - 当前模型版本
   - Embedding 服务状态
2. 实现幂等回填服务，为既有 PlaceSource 创建公共知识。
3. 回填按小批次运行，单批失败不回滚已完成批次。
4. 不提供返回私人知识正文的诊断接口。
5. 文档记录本地启动、模型首次下载、健康检查和降级行为。
6. 执行中韩跨语言人工验收：用中文查询韩文地点资料。

### 全量验证

```powershell
npm run prisma:generate -w @koreamate/api
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
git diff --check
```

生产构建若修改 `frontend/next-env.d.ts`，恢复其开发态生成引用后再提交。

### 验收标准

- 公共地点可被中文问题从韩文资料中召回。
- 用户只能检索自己的私人攻略。
- Planner 明确区分官方事实与攻略经验。
- 删除私人攻略后立即不可检索。
- BGE-M3、pgvector 任一不可用时，翻译和基础规划仍然工作。
- 所有合同、单元、集成、类型、Lint 和构建检查通过。
- Git 中不包含模型权重、API Key 或用户攻略正文 fixture。

### 提交

```text
feat: complete knowledge rag diagnostics
```

## 推荐执行顺序

严格按任务 1 → 10 顺序执行。任务 1–5 建立基础能力，任务 6–8 完成知识闭环，任务 9 才接入 Planner，任务 10 负责既有数据回填和最终验收。任何阶段失败时，现有旅行规划和翻译功能均应保持可用。
