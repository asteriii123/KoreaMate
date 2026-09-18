# KoreaMate CrewAI 多智能体架构设计

> 本文档及后续 Agent 相关设计、配置、运行代码统一放在 `agent/` 目录；文件名必须明确包含职责或组件名称，避免使用 `service.ts`、`agent.py` 等模糊名称。

## 1. 背景与目标

当前系统由 `ConversationService` 进行意图分类，再把请求路由到 `TravelService`、`TranslationService` 等固定流程。旅行服务内部还包含大量正则识别和条件分支，LLM 只负责局部结构化提取或行程 JSON 生成。

本设计将统一对话入口改造成独立的 Python CrewAI Agent Service。CrewAI Flow 负责运行状态和任务生命周期，多个专职 Agent 负责上下文整理、意图路由、旅行规划、翻译、检索、记忆和结果核验。领域服务仍负责数据一致性、权限、版本和外部服务适配，但不再负责决定跨领域执行顺序。

## 2. 非目标

- 不引入多个自治 Agent 或 Agent 间通信协议。
- 不允许模型直接访问 Prisma、HTTP 客户端或外部 MCP。
- 不把数据库事务、权限隔离、TripVersion 版本规则交给模型。
- 不要求一次性重写所有领域服务；迁移允许分阶段完成。

## 3. 总体架构

```text
ConversationsService (NestJS Gateway)
        |
        v
CrewAI Agent Service (Python)
        |
        +-- UnifiedConversationFlow
        +-- ContextManagerAgent
        +-- IntentRouterAgent
        +-- TravelPlannerAgent
        +-- TranslationAgent
        +-- ResearchAgent
        +-- MemoryAgent
        +-- ExecutionVerifierAgent
        |
        +-- CrewAI Tools / MCP Tools
        |       |
        |       +-- NestJS Domain Tool API
        |       +-- External provider adapters
        |
        +-- Flow state / checkpoint store
```

`ConversationsService` 仅负责消息、Job、身份校验和启动 Flow。CrewAI Flow 负责一次 Agent Run 的生命周期和状态传递。CrewAI 工具通过内部 NestJS Tool API 或 MCP 调用现有领域服务；Agent 不直接访问 Prisma。

## 3.1 CrewAI 角色

- `ContextManagerAgent`：加载会话、当前行程、记忆和附件，形成任务上下文。
- `IntentRouterAgent`：识别单领域或组合任务，选择需要启动的 Crew。
- `TravelPlannerAgent`：规划需求补全、行程创建和行程修改任务。
- `TranslationAgent`：文本、图片 OCR 和中韩翻译。
- `ResearchAgent`：地点、天气、航班、酒店、知识和攻略检索。
- `MemoryAgent`：读取、提取、更新和删除长期偏好。
- `ExecutionVerifierAgent`：验证工具结果、约束、引用和安全状态。

Agent 之间不进行无边界自由聊天；由 `UnifiedConversationFlow` 按状态和任务结果传递结构化输出。

## 4. CrewAI Flow 与执行模型

### 4.1 执行循环

Flow 接收 NestJS 的 `AgentRunRequest`，先执行上下文整理和意图路由，再按路由启动一个或多个 Crew。每个 Crew 使用明确的 Agent、Task 和工具集合；工具结果回写 Flow 状态，随后进入核验、追问、确认或最终回复节点。

Runtime 执行工具并将结构化结果作为 observation 追加到当前 run，然后继续循环。循环在以下条件之一满足时结束：最终回复、用户问题、确认等待、达到步数/时间限制或不可恢复错误。

### 4.2 保护边界

- 每次 run 设置最大步数、总超时和单工具超时。
- 工具调用使用 `runId + stepId + idempotencyKey` 幂等。
- 工具输入使用 Zod schema 校验；无效模型调用最多自动修复一次。
- 外部服务失败只允许有限重试，之后返回可解释错误。
- 删除、覆盖、永久记忆、修改行程等高风险工具必须返回 confirmation request。
- Runtime 不允许绕过工具直接写数据库。

## 5. 持久化模型

Agent 服务使用 Flow 状态和 checkpoint；业务审计实体仍由 NestJS/Prisma 持久化。新增以下实体（字段可按现有 Prisma 命名规范调整）：

- `AgentRun`：`id`、`conversationId`、`jobId`、`status`、`model`、`startedAt`、`completedAt`、`errorCode`。
- `AgentStep`：`id`、`runId`、`sequence`、`kind`（model/tool/final/confirmation）、`input`、`output`、`createdAt`。
- `AgentToolCall`：`id`、`stepId`、`toolName`、`arguments`、`result`、`status`、`durationMs`、`idempotencyKey`。
- `AgentCheckpoint`：`runId`、`sequence`、`context`、`pendingAction`，用于失败恢复和确认后继续。

所有记录通过所属 `Conversation` 关联，并沿用现有 user/guest owner 过滤，应用层不得先全量查询再过滤。

## 6. 上下文模型

`AgentContext` 包含：

- 当前消息及附件引用；
- 最近对话消息；
- 当前旅行需求和最新 `TripVersion`；
- 用户长期记忆；
- 已执行工具调用和结果摘要；
- 用户身份、语言、时区和当前日期；
- 可用工具、权限和待确认操作。

上下文由 `AgentContextAssembler` 从数据库和安全的领域接口组装。长对话使用最近消息 + 摘要 + 当前任务状态，避免把无限历史直接放入模型上下文。当前消息中的明确值始终覆盖长期记忆。

## 7. CrewAI 工具协议

```python
class KoreaMateTool(BaseTool):
    name: str
    description: str
    args_schema: Type[BaseModel]

    def _run(self, **kwargs) -> dict:
        # 通过 NestJS Tool API/MCP 调用领域能力
        ...
```

工具需要同时声明风险级别和身份上下文。CrewAI 工具不得直接连接 Prisma；写操作由 NestJS Tool API 执行。

```ts
type DomainToolRequest<TInput> = {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  risk: "read" | "write" | "destructive";
  execute(input: TInput, context: ToolContext): Promise<TResult>;
};
```

首批工具包括：地点搜索、天气查询、航班查询、酒店查询、创建/修改/读取行程、文本翻译、图片翻译、记忆增删查、攻略导入、知识检索、收藏增删查。

工具结果必须是结构化数据，并携带来源、时间和错误信息。引用由 `CitationFactory` 统一生成，模型不得自行生成 Citation。

## 8. 行程和记忆规则

- `create_trip_plan` 和 `modify_trip_plan` 只能创建新的 `TripVersion`，不能覆盖旧版本。
- 行程工具负责事务、地点核验、天气/汇率补充和引用组装；Agent 只决定何时调用。
- 记忆工具只填补缺失字段；本次明确输入优先于长期偏好。
- 私人收藏、记忆和图片工具必须使用 `userId` 或 `guestId` 作为查询边界。

## 9. 事件与 API 行为

保留现有 Job 异步模型。新增事件：`agent.started`、`agent.thinking`、`agent.tool.started`、`agent.tool.completed`、`agent.confirmation.required`、`agent.question`、`agent.result.ready`、`agent.failed`。前端可继续消费 Job Event，不需要理解模型内部 token。

统一入口收到消息后只创建 Job 并启动 `UnifiedAgentService`。翻译、旅行和统一模式最终都经过 Agent；旧模式字段可暂时保留以兼容历史会话，但不再决定执行分支。

## 10. 迁移阶段

1. 创建 `agent/crewai-service/`，建立 Flow、Agent、Task、Tool、checkpoint 和 HTTP/MCP 入口。
2. 将天气、地点、航班、酒店、知识检索、翻译、OCR、攻略、收藏和记忆包装成 CrewAI Tools。
3. 将行程创建/修改包装成写工具，加入确认、版本和幂等保护。
4. 让 NestJS 统一入口调用 CrewAI Flow，旧服务仅作为领域工具实现。
5. 删除 `ConversationService` 的意图路由和 `TravelService` 的跨领域固定分支。
6. 增加 CrewAI Flow 回归测试、工具失败恢复、权限隔离和 Agent trajectory 评估。

## 11. 测试与验收标准

- 同一用户连续提出旅行、天气、翻译和收藏请求时，Agent 能根据上下文选择正确工具。
- 缺少关键信息时只提出一个必要问题，并在下一轮继续原任务。
- 工具返回失败时 Agent 能重试或换方案，不生成虚假的结果。
- 修改行程后旧版本仍可读取，新版本编号递增。
- 不同 user/guest 之间无法读取记忆、收藏或图片。
- 重复消息和重复工具调用不会重复创建行程或记忆。
- 高风险操作在确认前不产生写入。
- 每次运行都能通过 `AgentRun`、`AgentStep` 和 `AgentToolCall` 还原执行轨迹。

## 12. 关键取舍

本设计选择“单一 Agent + 明确工具注册表”，而不是把所有服务直接暴露给模型，也不是立即引入多 Agent。这样可以让模型决定意图和执行顺序，同时把权限、事务、版本、引用和数据隔离继续锁在确定性的领域工具中，降低迁移风险并保留可测试性。
