# KoreaMate 第八阶段 8B：长期偏好 Memory 实施计划

设计依据：`docs/superpowers/specs/2026-09-16-koreamate-stage8b-memory-design.md`

## 任务 1：定义 Memory 契约和数据库模型

涉及文件：

- 修改 `shared/contracts/src/index.ts`
- 修改 `shared/contracts/src/index.test.ts`
- 修改 `backend/prisma/schema.prisma`
- 新增 Prisma migration

实现内容：

1. 定义五种 `MemoryKind`、预算档位、节奏及 `UserMemory` 响应 Schema。
2. 定义候选偏好 Schema，限制 value 长度、置信度范围和单次候选数量。
3. 增加 `travel.memory.updated`、`travel.memory.question` 事件。
4. 新增 `UserMemory` 表、身份检查约束、单值唯一约束和多值去重索引。
5. `sourceMessageId` 删除时置空，身份删除时级联。

测试先行：合法五类通过；未知 kind、低置信度、超长值和非法枚举被拒绝。

## 任务 2：实现身份隔离的 Memory 服务和 API

涉及文件：

- 新增 `backend/src/modules/memory/memory.module.ts`
- 新增 `backend/src/modules/memory/memory.service.ts`
- 新增 `backend/src/modules/memory/memory.controller.ts`
- 新增服务与集成测试
- 修改 `backend/src/app.module.ts`
- 修改 `docs/api.md`

实现内容：

1. 实现 `GET /api/v1/memories` 和 `DELETE /api/v1/memories/:id`。
2. 提供内部 `upsertCandidates`、`listForPlanner` 和按自然语言目标删除能力。
3. 单值类型替换，多值类型按归一化值幂等去重。
4. 所有读写按当前用户或游客隔离，越权按不存在处理。
5. 列表按固定 kind 顺序和更新时间输出。

测试先行：用户/游客隔离、单值覆盖、多值去重、删除和越权均有覆盖。

## 任务 3：实现受约束的 AI 偏好提取器

涉及文件：

- 新增 `backend/src/modules/memory/memory-extractor.ts`
- 新增 `backend/src/modules/memory/openai-compatible-memory.extractor.ts`
- 新增对应单元测试
- 修改 `.env.example`（仅复用现有 LLM 配置，不增加密钥）

实现内容：

1. 使用现有 OpenAI-compatible LLM 提取结构化候选。
2. 明确提示只允许五类旅行偏好，禁止敏感属性和单次信息。
3. 结果通过共享 Schema；只保存置信度不低于 0.8 的候选。
4. 提取超时、无配置、非法 JSON 或供应商失败时返回空候选，不影响规划。
5. 增加轻量规则回退，覆盖“我不吃辣”“我喜欢轻松一点”等高确定性表达。

测试先行：五类表达、临时日期/人数拒绝、敏感信息拒绝、失败降级均有覆盖。

## 任务 4：将 Memory 合并到 Planner 上下文

涉及文件：

- 修改 `backend/src/modules/travel/travel-provider.ts`
- 修改 `backend/src/modules/travel/openai-compatible-travel.provider.ts`
- 修改 `backend/src/modules/travel/travel.service.ts`
- 修改 Provider 与旅行集成测试

实现内容：

1. Planner 输入新增独立 `memory` 区块。
2. 旅行任务读取当前身份 Memory，并只补充缺失的出发城市和节奏。
3. 兴趣和限制去重合并；本次明确否定时排除对应长期项。
4. 预算档位作为文字偏好，不转换为固定金额。
5. 消息正常规划与候选提取并行；规划完成后校验写入并发出轻提示事件。
6. 固定优先级：本次输入 > 当前 TripRequirement > Memory > 默认值。

测试先行：Memory 填空、明确输入覆盖、否定排除、提取失败仍生成计划且不新增错误版本。

## 任务 5：扩展游客登录归并

涉及文件：

- 修改 `backend/src/modules/auth/identity.service.ts`
- 修改身份与集成测试

实现内容：

1. 在现有会话和收藏归并事务中加入 Memory。
2. 单值类型账户已有值优先，缺失时采用游客值。
3. 多值类型按 kind 和 normalizedValue 去重合并。
4. 重复游客记录删除，整个归并事务保持原子性。

## 任务 6：实现账户面板和偏好管理界面

涉及文件：

- 修改 `frontend/components/shell/app-shell.tsx`
- 修改 `frontend/components/shell/app-shell.module.css`
- 修改 `frontend/lib/api.ts`
- 新增账户面板相关组件测试

实现内容：

1. 侧边栏底部头像统一打开账户面板，不新增主导航入口。
2. 游客显示登录按钮、跨设备提示与“我的偏好”；登录用户显示邮箱与退出。
3. 偏好按五类分组展示，支持逐项删除和失败回滚。
4. 提供空状态、加载状态、移动端适配和完整键盘可访问性。

## 任务 7：支持自然语言查看和遗忘

涉及文件：

- 新增 `backend/src/modules/memory/memory-intent.ts` 及测试
- 修改 `backend/src/modules/travel/travel.service.ts`
- 修改 `frontend/components/conversation/conversation-screen.tsx`
- 修改旅行集成测试

实现内容：

1. 在重新规划前识别“你记住了什么”和“忘掉……”意图。
2. 唯一匹配直接删除，多候选发出 `travel.memory.question`。
3. 查看最多返回八项摘要；查看和删除不创建 `TripVersion`。
4. 前端显示轻提示或追问，不生成额外行程卡。

## 任务 8：真实验收与质量门槛

执行：

1. 游客表达成都出发、不吃辣和轻松节奏，新行程验证自动采用。
2. 本次改为上海出发，验证当前输入覆盖长期 Memory。
3. 登录验证游客 Memory 去重归并。
4. 从账户面板删除限制，新行程不再采用。
5. 验证查看和遗忘指令不生成新报告。
6. 运行 `npm run typecheck`、`npm test`、`npm run test:integration`、`npm run lint`、`npm run build` 和 `git diff --check`。

完成标准：五类偏好可自动、透明、可撤销地保存；Memory 只填缺失项，游客登录不丢失，任何 Memory 故障均不阻塞旅行规划。
