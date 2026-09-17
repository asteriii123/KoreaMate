# AGENTS.md

面向 AI 助手的架构与边界说明。

## 不是多 Agent，是受控工作流

KoreaMate 刻意**不建立独立自治 Agent**。一个 OpenAI 兼容 LLM 被四种 prompt 驱动，完成四类任务，全部由 NestJS 中的确定性代码编排：

| 角色 | 文件 | 职责 |
| --- | --- | --- |
| 旅行规划器 | `backend/src/modules/travel/openai-compatible-travel.provider.ts` | 提取需求、判断缺啥、只问一个问题、生成逐日行程 JSON |
| 翻译器 | `backend/src/modules/translation/openai-compatible-translation.provider.ts` | 中韩互译 + 图片 OCR 文字整理 |
| 记忆提取器 | `backend/src/modules/memory/openai-compatible-memory.extractor.ts` | 从对话提取五类长期偏好 |
| 攻略提取器 | `backend/src/modules/travel/guide-import.service.ts` | 从小红书笔记/截图提取具体地点 |

核心编排器是 `backend/src/modules/travel/travel.service.ts`。

## Provider / MCP

外部服务通过领域接口接入，业务不依赖具体 MCP 的原始响应：

- 地点：Kakao（REST）、韩国旅游 MCP
- 天气：Open-Meteo（REST）；汇率：Frankfurter（REST）
- 航班：Variflight MCP；酒店：RollingGo MCP
- OCR：PaddleOCR（本地 FastMCP）；语音：faster-whisper（本地 REST）；向量：BGE-M3（本地 REST）

## 边界

- 修改行程创建新 `TripVersion`，不得覆盖旧版本。
- Memory 只填缺失字段，本次明确输入永远优先于长期偏好。
- 引用由 `CitationFactory` 统一生成，Planner 不得生成 `Citation`。
- 私人知识/图片必须按 `userId` 或 `guestId` 隔离，不得在应用层查询后再过滤。
