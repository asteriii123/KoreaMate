# KoreaMate 第八阶段 8A：地点收藏实施计划

设计依据：`docs/superpowers/specs/2026-09-16-koreamate-stage8a-saved-places-design.md`

## 任务 1：扩展共享契约与行程地点数据

涉及文件：

- 修改 `shared/contracts/src/index.ts`
- 修改 `shared/contracts/src/index.test.ts`
- 修改 `backend/src/modules/travel/travel.service.ts`
- 修改相关旅行服务测试

实现内容：

1. 给行程项目中的 `place` 增加稳定的 `id`、可空 `nameZh` 和收藏状态 `saved`。
2. 新增 `SavedPlaceSchema`、`SavedPlaceListSchema`、创建/更新请求 schema，以及对应 TypeScript 类型。
3. 给任务事件类型增加 `travel.saved-place.ready` 和 `travel.saved-place.question`。
4. 调整行程序列化查询，返回地点 ID、中文名和当前身份的收藏状态；不得再用名称判断是否收藏。
5. 保持旧行程中无地点的项目仍能通过契约解析。

测试先行：

- 新契约能解析完整收藏数据。
- 非 UUID 地点、超长备注和非法事件类型被拒绝。
- 行程地点稳定返回 `place.id`；无地点项目保持 `null`。

验证：

- `npm test -w @koreamate/contracts`
- `npm run typecheck -w @koreamate/contracts`

## 任务 2：建立收藏数据模型与中文地点名

涉及文件：

- 修改 `backend/prisma/schema.prisma`
- 新增 Prisma migration
- 修改 `backend/src/modules/places/places.service.ts`
- 修改 `backend/src/modules/travel/travel.service.ts`

实现内容：

1. 给 `Place` 新增可空 `nameZh`，并建立与 `SavedPlace` 的关系。
2. 新增 `SavedPlace`，包含 `id`、`placeId`、`userId`、`guestId`、`note`、`createdAt`、`updatedAt`。
3. 分别建立 `(userId, placeId)` 与 `(guestId, placeId)` 唯一约束及必要索引。
4. 在 SQL migration 中加入 `userId`、`guestId` 恰好一个非空的检查约束。
5. 地点、用户或游客删除时级联删除收藏。
6. 规划落库时，将已核验行程项目的中文标题写入空的 `Place.nameZh`；不覆盖已有中文名，不额外调用 LLM。
7. 对已有地点执行一次尽力回填：从最近的关联行程项目标题填充仍为空的 `nameZh`。

验证：

- `npx prisma validate --schema backend/prisma/schema.prisma`
- `npx prisma generate --schema backend/prisma/schema.prisma`
- 应用 migration 后检查唯一约束和身份检查约束生效。

## 任务 3：实现收藏服务与身份隔离 API

涉及文件：

- 新增 `backend/src/modules/saved-places/saved-places.module.ts`
- 新增 `backend/src/modules/saved-places/saved-places.controller.ts`
- 新增 `backend/src/modules/saved-places/saved-places.service.ts`
- 新增 `backend/src/modules/saved-places/saved-places.service.test.ts`
- 修改 `backend/src/app.module.ts`
- 修改 `docs/api.md`

实现内容：

1. 实现 `GET /api/v1/saved-places`，按 `createdAt desc` 返回当前身份收藏。
2. 实现幂等 `POST /api/v1/saved-places`，只接受 `placeId` 和可选 `note`。
3. 实现 `PATCH /api/v1/saved-places/:id` 更新不超过 240 字符的备注。
4. 实现 `DELETE /api/v1/saved-places/:id`，只删除当前身份所属记录。
5. 所有入口通过 `IdentityService.resolve` 获取身份，忽略并拒绝客户端身份字段。
6. 列表响应返回中文显示名、韩文原名、地址、坐标、最新地图来源链接与时间。
7. 地点不存在返回 404；越权读取或删除统一按不存在处理，避免泄露记录。

测试先行：

- 游客和登录用户分别完成创建、列表、更新和删除。
- 重复 POST 返回同一收藏且数据库只有一条记录。
- A 身份无法读取、更新或删除 B 身份收藏。
- 删除收藏不删除 `Place`、`PlaceSource` 或 `ItineraryItem`。
- 地图来源缺失时 `mapUrl` 为 `null`。

验证：

- `npm test -w @koreamate/api -- saved-places`
- `npm run typecheck -w @koreamate/api`

## 任务 4：把游客收藏安全归并到登录账户

涉及文件：

- 修改 `backend/src/modules/auth/identity.service.ts`
- 新增或修改身份服务测试
- 修改 `backend/test/conversation.integration.test.ts`

实现内容：

1. 将 `createSession` 的游客归并事务扩展到 `SavedPlace`。
2. 用户未收藏的地点迁移为用户记录。
3. 重复地点保留用户记录；仅当用户备注为空时复制游客备注。
4. 删除已归并的重复游客收藏，再标记游客身份为已合并。
5. 保持会话归并和收藏归并在同一事务内，任一步失败时整体回滚。

测试先行：

- 非重复收藏全部迁移。
- 重复收藏只保留一条。
- 用户已有备注优先；用户无备注时采用游客备注。
- 归并失败不会留下半迁移状态。

验证：

- `npm run test:integration`

## 任务 5：增加侧边栏入口与“我的收藏”页面

涉及文件：

- 修改 `frontend/components/shell/app-shell.tsx`
- 修改 `frontend/components/shell/app-shell.module.css`
- 新增 `frontend/app/saved/page.tsx`
- 新增 `frontend/app/saved/page.test.tsx`
- 新增 `frontend/app/saved/saved.module.css`
- 修改 `frontend/lib/api.ts`

实现内容：

1. 在“开始出发吧”和“历史记录”之后增加固定入口“我的收藏”。
2. 展开侧边栏显示文字，收起状态显示可访问图标，移动端抽屉行为与现有入口一致。
3. 收藏页加载单列卡片，显示 `nameZh ?? name`，并在名称不同时显示韩文原名。
4. 显示地址、备注、地图入口和“用它规划行程”；无地图链接时隐藏入口。
5. 空状态提供“去规划旅行”。
6. “用它规划行程”跳转 `/travel?prefill=...`，只预填输入框，不自动发送。
7. 删除采用乐观更新，底部显示 5 秒“已移除 · 撤销”；失败时恢复原项并提示。
8. 页面监听登录状态变化并重新加载收藏。

测试先行：

- 三个侧边栏入口顺序、激活状态和可访问名称正确。
- 收藏页覆盖加载、列表、空状态和失败状态。
- 中文名优先、韩文名补充显示。
- 删除、5 秒撤销和请求失败回滚行为正确。
- 规划跳转只预填且不自动提交。

验证：

- `npm test -w @koreamate/web`
- `npm run typecheck -w @koreamate/web`

## 任务 6：在行程卡片加入一键收藏

涉及文件：

- 修改 `frontend/components/conversation/conversation-screen.tsx`
- 修改 `frontend/components/conversation/conversation-screen.module.css`
- 修改 `frontend/components/conversation/conversation-screen.test.ts`
- 修改 `frontend/lib/api.ts`

实现内容：

1. 只对已经绑定 `place.id` 的行程项目显示心形按钮。
2. 未收藏显示轮廓状态和“收藏地点”，已收藏显示实心状态和“取消收藏”。
3. 点击区域至少 44 × 44 像素，同时使用图形、文本替代和 `aria-pressed` 表达状态。
4. 收藏与取消收藏均采用乐观更新；请求失败恢复原状态并给出简短错误。
5. 同一地点出现在多个日期时同步更新所有实例。
6. 打开历史行程时从后端恢复真实收藏状态。

测试先行：

- 无 `place.id` 时不显示按钮。
- 收藏、取消收藏、重复点击和失败回滚正确。
- 相同地点多实例状态同步。
- 键盘可操作且可访问名称正确。

验证：

- `npm test -w @koreamate/web -- conversation-screen`

## 任务 7：接入自然语言收藏意图

涉及文件：

- 新增 `backend/src/modules/travel/saved-place-intent.ts`
- 新增 `backend/src/modules/travel/saved-place-intent.test.ts`
- 修改 `backend/src/modules/travel/travel.service.ts`
- 修改 `backend/src/modules/travel/travel.module.ts`
- 修改 `backend/test/conversation.integration.test.ts`
- 修改 `frontend/components/conversation/conversation-screen.tsx`

实现内容：

1. 在确认、天气、酒店、航班和重新规划之前识别收藏、取消收藏与查看收藏意图。
2. 明确名称仅匹配当前会话已核验的 `Place`；不得凭自由文本创建地点。
3. “这个地方”“刚才那个”等指代，只在当前会话最近一个核验地点唯一时执行。
4. 多候选时返回最多三个候选并发出 `travel.saved-place.question`，下一次回答只解析该选择。
5. 唯一匹配时调用同一收藏服务，发出 `travel.saved-place.ready` 并写入简短助手消息。
6. 查看收藏返回短摘要和 `/saved` 入口，不生成行程版本。
7. 无匹配时提示先搜索或生成行程；第一版不自动调用新地点搜索。
8. 前端消费两个事件，更新卡片收藏状态或显示轻量候选确认，不生成新计划卡。

测试先行：

- “记住景福宫”收藏明确地点。
- “收藏这个地方”解析唯一最近地点。
- 多候选只追问一次并能用数字回答。
- 无核验地点不创建 `Place` 或 `SavedPlace`。
- 收藏问答不增加 `TripVersion`，也不触发 `travel.plan.ready`。
- 取消收藏与查看收藏走各自独立响应。

验证：

- `npm test -w @koreamate/api -- saved-place-intent`
- `npm run test:integration`

## 任务 8：真实链路验收与质量门槛

执行：

1. 应用 Prisma migration 并启动 Web 与 API。
2. 生成含核验地点的行程，从卡片收藏一个地点。
3. 打开“我的收藏”，检查中文名、韩文原名、地址和地图链接。
4. 删除后在 5 秒内撤销，再次确认恢复。
5. 点击“用它规划行程”，确认只预填输入框。
6. 以游客收藏，邮箱登录后确认收藏归并且不重复。
7. 在旅行对话中依次验证“记住景福宫”“收藏这个地方”“我收藏的地方”。
8. 检查收藏操作不会生成新行程报告或新版本。
9. 检查桌面展开、桌面收起和移动端侧边栏的第三入口。

质量命令：

1. `npm run typecheck`
2. `npm test`
3. `npm run test:integration`
4. `npm run lint`
5. `npm run build`
6. `git diff --check`

完成标准：

- 用户能用一次点击或一句话收藏已核验地点。
- 侧边栏固定显示“开始出发吧、历史记录、我的收藏”。
- 收藏页对中国用户优先展示中文地点名。
- 游客收藏在登录后完整、去重地归并。
- 删除可在 5 秒内撤销，“用它规划行程”不会未经确认自动发送。
- 收藏相关操作不触发重新规划，不产生新的行程报告。
- 全部自动化检查与真实浏览器验收通过。
