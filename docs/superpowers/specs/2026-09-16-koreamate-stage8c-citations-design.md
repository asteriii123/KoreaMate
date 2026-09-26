# KoreaMate 第八阶段 8C：来源引用与可信状态设计

## 目标

让用户能快速区分真实数据、可能变化的实时信息和 KoreaMate 的规划判断，同时保持页面简洁。来源默认以短标签展示，点击后才展开详情。

产品文案不使用“AI 建议”，统一使用“小助理建议”。

## 三种可信状态

### 已核验

用于来自真实地点 Provider 的名称、地址、坐标和地图链接。第一版来源包括 Kakao 和韩国旅游数据源。只有存在已保存的 `PlaceSource` 时才可显示“已核验”。

### 实时参考

用于天气、汇率、酒店和航班查询结果。标签表示数据在抓取时来自外部接口，但价格、房态、余票、汇率和天气仍可能变化。

### 小助理建议

用于行程时间安排、推荐理由、交通衔接判断和预计费用。该状态不附加虚假外部来源，并统一提示以现场情况和最终预订页面为准。

## 展示原则

默认只显示简短标签：

```text
已核验 · Kakao
实时参考 · Open-Meteo
小助理建议
```

点击真实来源标签后展开：

- 中文来源名称。
- 数据获取或更新时间。
- 新鲜度状态。
- Provider 保存的原始页面链接（存在时）。

不在每句话后显示引用编号。行程项目中的时间、理由和费用共用一条“小助理建议，请以现场情况为准”，避免重复干扰阅读。

## 数据结构

共享契约新增统一 `Citation`：

```text
status: verified | live_reference | assistant_suggestion
provider: kakao | korea-tourism | open-meteo | frankfurter | rollinggo-hotel | variflight | koreamate
label
sourceUrl nullable
fetchedAt nullable
expiresAt nullable
stale
```

规则：

- `verified` 和 `live_reference` 必须有真实 Provider 与 `fetchedAt`。
- `assistant_suggestion` 的 Provider 固定为 `koreamate`，没有 `sourceUrl`。
- `sourceUrl` 只能来自数据库中的 `PlaceSource` 或 Provider 标准化响应，不能来自 Planner 文本。
- `stale` 由服务端根据 `expiresAt` 和当前时间计算，客户端不得自行宣称数据新鲜。

## 各类数据绑定

### 地点

行程项目的 `place` 增加 `citation`。服务端读取最新有效 `PlaceSource`：

- 有来源：显示“已核验”。
- 来源已过期：仍显示来源，但标注“数据可能已变化”。
- 无来源：不显示“已核验”，只保留“小助理建议”。

地点地图入口继续使用同一个可信 `sourceUrl`，不生成搜索链接替代。

### 天气和汇率

现有天气与汇率契约增加 `citation`：

- Open-Meteo → “实时参考 · Open-Meteo”。
- Frankfurter → “实时参考 · Frankfurter”。

`TripResource.expiresAt` 用于判断是否过期。恢复历史行程时必须保留当时抓取时间，并明确数据可能已经变化。

### 酒店和航班

酒店与航班结果增加结果级 `citation`，整组卡片共用，不给每个选项重复显示。

- 酒店来源：RollingGo。
- 航班来源：Variflight/RollingGo 对应实际 Provider。
- 预订或查看链接必须来自 Provider 响应。

价格、房态和余票始终显示“预订前再次确认”。

### 行程规划内容

每个 Day 卡片底部显示一次：

```text
小助理建议 · 时间与费用请以现场情况为准
```

不为 Planner 生成的描述、时间或估算伪造引用。

## 前端交互

新增通用 `CitationBadge`：

- 默认是可点击的胶囊标签。
- 展开后显示来源、更新时间、新鲜度和原始链接。
- 再次点击、按 Escape 或点击外部时关闭。
- 只有存在详情时才使用按钮；“小助理建议”可作为静态标签。
- 支持键盘操作、焦点可见和屏幕阅读器状态。
- 移动端详情使用就近浮层或内联展开，不超出屏幕。

文案：

- 新鲜：`更新于今天 14:30` 或具体日期。
- 过期：`数据可能已变化`。
- 无链接：只显示来源与时间，不渲染无效按钮。

## 服务端生成原则

引用由普通程序根据 Provider 记录生成，Planner 不负责生成 `Citation`。

```text
Provider 标准化结果 / PlaceSource / TripResource
  → CitationFactory
  → 共享契约校验
  → TripPlan API 与 SSE
  → CitationBadge
```

新增 `CitationFactory` 负责 Provider 中文名、状态、新鲜度和安全链接映射。所有调用方使用同一实现，避免前端自行猜测来源。

## URL 安全

- 只接受 `https:` 来源链接。
- 限制为对应 Provider 的允许域名。
- 链接使用新窗口并带 `noopener noreferrer`。
- 非法、未知或 Planner 生成的 URL 丢弃，不影响主体内容展示。

## 错误和降级

- 来源缺失：隐藏真实来源标签，不影响行程展示。
- 来源过期：保留标签并显示“数据可能已变化”。
- Provider 查询失败：沿用现有失败提示，不创建虚假引用。
- 历史行程缺少新字段：共享契约允许兼容默认值，显示“小助理建议”。
- 外部链接无效：隐藏链接，仍显示 Provider 和时间。

## 测试

后端覆盖：

- 各 Provider 正确映射状态与中文标签。
- 过期时间正确生成 `stale`。
- 无来源不得显示 `verified`。
- 非 HTTPS、非允许域名和 Planner URL 被移除。
- 恢复历史行程保留抓取时间与过期状态。

前端覆盖：

- 三种状态文案正确，禁止出现“AI 建议”。
- 标签展开、关闭、Escape、外部点击和键盘焦点。
- 有链接与无链接、有效与过期状态。
- 移动端不溢出，行程 Day 只显示一次“小助理建议”。

真实验收：

1. 生成包含地点、天气、汇率、酒店和航班的行程。
2. 地点显示“已核验 · Kakao”，展开可看到真实链接和时间。
3. 天气与汇率显示对应“实时参考”。
4. Day 卡片显示一次“小助理建议”。
5. 修改测试时间使来源过期，页面显示“数据可能已变化”。
6. 检查页面和代码输出中不存在面向用户的“AI 建议”。

## 不在本切片范围

- 为所有自然语言句子生成引用编号。
- 用户评分或主观可信度百分比。
- 自动抓取网页正文作为证据。
- 向量知识库和 RAG 文档引用。
- 第三方 Provider 未返回的虚构链接。
