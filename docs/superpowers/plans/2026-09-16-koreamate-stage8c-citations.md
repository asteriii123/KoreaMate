# KoreaMate 第八阶段 8C：来源引用与可信状态实施计划

设计依据：`docs/superpowers/specs/2026-09-16-koreamate-stage8c-citations-design.md`

## 任务 1：建立统一引用契约

涉及 `shared/contracts/src/index.ts` 及测试。

1. 新增 `CitationSchema`，限定三种状态、七种 Provider、HTTPS URL、抓取时间、过期时间和 stale。
2. 给地点、天气、汇率、酒店结果和航班结果增加引用字段。
3. 历史数据通过可空或默认“小助理建议”保持兼容。
4. 测试非法状态、非法 URL、缺少真实来源时间和 Planner 伪造链接。

## 任务 2：实现服务端 CitationFactory

新增 `backend/src/modules/citations/citation.factory.ts` 及测试，并由旅行模块使用。

1. 集中映射 Provider、中文标签和可信状态。
2. 根据 `expiresAt` 计算 stale。
3. 仅允许 Kakao、韩国旅游、Open-Meteo、Frankfurter、RollingGo 与 Variflight 官方域名。
4. 无效 URL 降级为 null，不影响主体数据。
5. 提供固定的“小助理建议”引用。

## 任务 3：给地点和历史行程绑定来源

修改 `backend/src/modules/travel/travel.service.ts` 和相关集成测试。

1. 查询地点时读取最新 `PlaceSource` 的 provider、sourceUrl、fetchedAt 与 expiresAt。
2. `toContract` 输出地点 citation。
3. 无 `PlaceSource` 时不得输出“已核验”。
4. 新生成、历史打开、确认行程和版本恢复使用同一逻辑。

## 任务 4：给天气、汇率、酒店和航班绑定来源

修改各 Provider、`trip-context.service.ts`、旅行服务及测试。

1. 天气与汇率用真实 fetchedAt 和缓存 expiresAt 生成引用。
2. 酒店和航班输出结果级引用，整组卡片复用。
3. Provider 失败时不创建虚假来源。
4. 历史 TripResource 恢复时保留原抓取时间和过期状态。

## 任务 5：实现 CitationBadge

新增通用前端组件、样式和测试，并修改行程卡片。

1. 默认显示“已核验 · Kakao”“实时参考 · Open-Meteo”等胶囊标签。
2. 点击展开来源、时间、新鲜度和可选原始链接。
3. 支持再次点击、Escape、外部点击、焦点可见和屏幕阅读器状态。
4. 移动端采用内联展开，避免溢出。

## 任务 6：展示“小助理建议”

修改行程 Day、天气、汇率、酒店和航班卡片及测试。

1. 每个 Day 只显示一次“小助理建议 · 时间与费用请以现场情况为准”。
2. 地点、天气、汇率、酒店、航班在对应位置显示真实来源标签。
3. 页面用户文案不得出现“AI 建议”。
4. stale 显示“数据可能已变化”。

## 任务 7：真实验收与质量门槛

1. 生成含地点、天气、汇率、酒店和航班的行程并逐项核对来源。
2. 验证外部链接均来自 Provider 且使用安全新窗口属性。
3. 构造过期数据验证 stale 文案。
4. 打开历史行程验证引用仍可用。
5. 运行 `npm run typecheck`、`npm test`、`npm run test:integration`、`npm run lint`、`npm run build`、`git diff --check`。

完成标准：用户能在不增加默认信息负担的情况下核验真实来源；任何无来源、过期或建议性内容都不会被错误标记为已核验。
