# KoreaMate 第七阶段本地 Whisper 实施计划

设计依据：`docs/superpowers/specs/2026-09-16-koreamate-stage7-local-whisper-design.md`

## 任务 1：建立 faster-whisper sidecar

涉及文件：

- 新增 `infrastructure/whisper/server.py`
- 新增 `infrastructure/whisper/requirements.txt`
- 新增 `infrastructure/whisper/README.md`
- 修改 `.gitignore`
- 修改根目录 `package.json`

实现内容：

1. 创建独立 Python 虚拟环境 `.venv-whisper`，固定 faster-whisper 与 HTTP 服务依赖。
2. 建立内部 HTTP 服务和健康检查。
3. 懒加载 `small` 多语言模型，使用 CPU INT8。
4. 以单并发锁串行执行转写，启用 VAD，返回文字、语言、语言概率和时长。
5. 使用随机临时文件并通过 `finally` 无条件删除。
6. 增加 `dev:whisper`，并将服务加入 `dev:all`。

验证：

- 服务未加载模型时健康检查可用。
- 第一次转写触发模型下载并成功加载。
- 中文和韩文样本返回非空文字及正确语言。
- 静音返回稳定空语音错误。
- 成功与失败后临时目录均无残留。

## 任务 2：定义共享语音契约

涉及文件：

- 修改 `shared/contracts/src/index.ts`
- 修改 `shared/contracts/src/index.test.ts`

实现内容：

1. 增加语音转写成功响应 schema。
2. 限制语言字段和语言概率范围。
3. 定义前端需要处理的稳定错误码。

验证：

- 合法响应可解析。
- 空文字、非法概率和非法语言被拒绝。

## 任务 3：实现 NestJS 语音代理

涉及文件：

- 新增 `backend/src/modules/speech/speech.module.ts`
- 新增 `backend/src/modules/speech/speech.controller.ts`
- 新增 `backend/src/modules/speech/speech.service.ts`
- 新增 `backend/src/modules/speech/whisper.provider.ts`
- 新增相应单元测试
- 修改 `backend/src/app.module.ts`
- 修改 `.env.example`

实现内容：

1. 新增 `POST /api/v1/speech/transcriptions` multipart 接口。
2. 接受 WebM、MP4/M4A、Ogg 和 WAV，最大 10 MB。
3. 沿用现有游客或账户 Cookie 身份，不建立独立匿名通道。
4. 将音频以流或 multipart 代理给内部 Whisper 服务。
5. 设置 90 秒请求超时，解析并校验 sidecar 响应。
6. 将格式、大小、空语音、超时和服务不可用映射为稳定中文 API 错误。
7. 日志只记录请求 ID、字节数、耗时和错误类别。

验证：

- 文件缺失、类型错误和超限在调用 sidecar 前被拒绝。
- 成功响应通过共享 schema。
- sidecar 不可用、超时、空结果和异常响应正确映射。
- 测试日志和数据库不包含音频内容。

## 任务 4：用 MediaRecorder 替换浏览器语音识别

涉及文件：

- 新增 `frontend/lib/audio-recorder.ts`
- 新增 `frontend/lib/audio-recorder.test.ts`
- 修改 `frontend/lib/api.ts`
- 修改 `frontend/components/conversation/conversation-screen.tsx`
- 修改 `frontend/components/conversation/conversation-screen.module.css`
- 修改相关组件测试
- 删除 `frontend/lib/speech-recognition.ts` 及其测试

实现内容：

1. 检测 `getUserMedia` 与 `MediaRecorder`，按优先顺序选择支持的 MIME。
2. 封装开始、手动停止、30 秒自动停止、Blob 生成和媒体轨道清理。
3. 麦克风按钮状态改为空闲、录音中、识别中。
4. 录音结束后调用语音转写 API。
5. 将返回文字追加到输入框，不覆盖已有内容、不自动发送。
6. 权限拒绝、无设备、空语音和服务异常显示可恢复提示。
7. 保留现有韩语 Speech Synthesis 朗读实现。

验证：

- MIME 选择覆盖 WebM、MP4 和 Ogg 回退。
- 再次点击和 30 秒计时均能停止录音。
- 每条媒体轨道都在完成、失败和卸载时停止。
- 转写内容追加且不会触发表单提交。
- 识别中按钮禁用，状态通过单一 `role="status"` 宣告。
- 文字、图片上传和 Enter 发送行为保持不变。

## 任务 5：真实端到端验证

执行：

1. 启动 Web、API、PaddleOCR 和 Whisper。
2. 使用中文短句录音验证“音频 → Whisper → 输入框”。
3. 使用韩文短句验证自动语言识别。
4. 使用静音和不支持格式验证错误提示。
5. 检查系统临时目录、数据库和应用日志没有音频数据。
6. 在 Codex 内置浏览器和系统 Chrome/Edge 中检查录音能力。

## 任务 6：质量门槛与交付

执行：

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run build`
5. 检查 Python 服务启动、健康检查和转写 smoke test。
6. 检查 Git 差异不包含虚拟环境、模型缓存、临时音频、密钥或生成文件。

完成标准：

- 当前内置浏览器不再依赖 Web Speech 在线服务。
- 中文和韩文录音均能转为可编辑文字。
- 录音最长 30 秒，最大 10 MB。
- 原始音频不会持久化或进入日志。
- Whisper 不可用时文字、图片翻译与韩语朗读继续工作。
- 所有自动化检查和真实 smoke test 通过。
