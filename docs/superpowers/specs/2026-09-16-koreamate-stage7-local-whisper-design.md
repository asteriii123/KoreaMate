# KoreaMate V3 第七阶段：本地 Whisper 语音识别设计

## 背景

现有翻译页使用浏览器 Web Speech API。该接口在当前内置浏览器中存在但其在线识别服务不可访问，导致用户授权麦克风后仍收到“语音识别暂时不可用”。浏览器原生识别因此不能作为 KoreaMate 的稳定语音入口。

本设计将语音识别替换为 KoreaMate 自己控制的本地服务。韩语朗读继续使用浏览器 Speech Synthesis，因为朗读失败不会阻断翻译主流程。

## 技术选择

采用 [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 和 OpenAI Whisper 多语言 `small` 模型：

- Python 3.9 或更高版本。
- CPU 推理，`compute_type="int8"`。
- 启用 Silero VAD 过滤静音片段。
- 不需要系统单独安装 FFmpeg；音频由 PyAV 解码。
- 首次启动自动下载模型，后续从本地缓存加载。
- faster-whisper 和 OpenAI Whisper 均采用 MIT 许可证。

OpenAI 官方将 `small` 列为 244M 参数的多语言模型。faster-whisper 官方 CPU 基准显示 `small + INT8` 运行时约占 1.5 GB 内存。该组合在中韩语准确度与免费 CPU 部署成本之间更平衡。

## 总体架构

```text
浏览器 MediaRecorder
  → KoreaMate NestJS API
  → 本地 faster-whisper sidecar
  → { text, language, languageProbability, duration }
  → 浏览器输入框
  → 用户确认后沿用现有文字翻译流程
```

浏览器不直接访问 Whisper 服务。NestJS 负责身份、请求限制、格式检查、超时和错误转换；Whisper sidecar 只接受来自应用内部的请求。

## 浏览器录音

翻译页保留现有麦克风按钮，但实现从 `SpeechRecognition` 改为 `MediaRecorder`：

1. 点击麦克风，请求 `getUserMedia({ audio: true })`。
2. 使用浏览器支持的优先格式录制：`audio/webm;codecs=opus`、`audio/webm`、`audio/mp4`、`audio/ogg`。
3. 再次点击或达到 30 秒时停止录音。
4. 将音频作为 `multipart/form-data` 上传到 NestJS。
5. 显示“正在识别语音……”并禁用再次录音，文字输入保持可编辑。
6. 返回文字后追加到输入框，不覆盖已有内容、不自动发送。

组件卸载、切换页面或发生异常时必须停止所有媒体轨道。录音 Blob 在请求结束后由浏览器释放，不写入客户端持久存储。

## API 契约

新增：

```http
POST /api/v1/speech/transcriptions
Content-Type: multipart/form-data
Cookie: 现有游客或登录会话

audio: <binary>
```

成功响应：

```json
{
  "text": "안녕하세요",
  "language": "ko",
  "languageProbability": 0.97,
  "duration": 1.8
}
```

约束：

- 支持 WebM、MP4/M4A、Ogg 和 WAV。
- 最大文件 10 MB。
- 产品交互限制为 30 秒；服务端拒绝明显超过限制的音频。
- 空文件、无语音结果和不支持格式返回稳定错误码。
- API 总超时 90 秒，覆盖 CPU 首次推理但不覆盖首次模型下载。

错误码：

- `SPEECH_UNSUPPORTED_FORMAT`
- `SPEECH_FILE_TOO_LARGE`
- `SPEECH_TOO_LONG`
- `SPEECH_EMPTY`
- `SPEECH_SERVICE_UNAVAILABLE`
- `SPEECH_TRANSCRIPTION_FAILED`

## Whisper sidecar

新增 `infrastructure/whisper/`：

- `server.py`：提供内部 HTTP 转写接口。
- `requirements.txt`：固定 faster-whisper 与服务框架版本。
- `README.md`：安装、模型缓存、启动和资源说明。

为了减少协议层复杂度，本切片使用简单内部 HTTP `multipart/form-data` 接口。Whisper 服务不是 Agent 工具，不需要模型自主决定是否调用，因此不引入 MCP。

服务启动后懒加载单例模型：

```python
WhisperModel("small", device="cpu", compute_type="int8")
```

转写参数：

- `task="transcribe"`
- `vad_filter=True`
- `beam_size=5`
- 自动识别语言，不提前固定中文或韩文。

服务使用单并发锁串行推理，防止多个 CPU 任务争抢内存。健康检查区分“服务已启动”和“模型已加载”。

## 临时文件与隐私

- NestJS 或 sidecar 使用操作系统临时目录保存单次请求文件。
- 文件名由随机 UUID 生成，不包含用户邮箱、原文件名或识别内容。
- `finally` 块保证成功、失败、超时和客户端断开后均删除临时文件。
- 数据库不新增音频字段，也不保存未发送的转写文字。
- 日志只记录请求 ID、耗时、字节数、检测语言和错误类别；不记录音频、Base64 或完整转写文本。
- 音频不会发送到 DeepSeek。只有用户检查并主动发送的文字进入现有翻译流程。

## 状态与错误体验

麦克风状态：

- 空闲：`开始语音输入`
- 录音中：`停止录音`，显示剩余时间或“最多 30 秒”
- 转写中：按钮禁用，显示“正在识别语音……”
- 完成：文字追加到输入框，状态清除

错误提示：

- 权限拒绝：请允许浏览器使用麦克风。
- 无设备：没有找到可用的麦克风。
- 无语音：没有听清，可以重新录制或输入文字。
- 服务未启动：本地语音服务暂不可用，文字和图片翻译仍可使用。
- 首次模型未准备：首次加载语音模型可能需要几分钟，请稍后重试。
- 其他失败：语音识别失败，请重试或直接输入文字。

任何错误都不会清空输入框、附件或已有结果。

## 运行与部署

开发环境增加独立启动命令，并将 Whisper 加入统一启动脚本：

```text
npm run dev:web/api/ocr/whisper
```

生产部署时 Whisper 与 PaddleOCR 同属 Python sidecar，但使用独立进程和健康检查。模型缓存挂载持久卷，避免每次部署重新下载。API 仅通过内部地址访问 Whisper，公网不暴露该端口。

公开部署前必须验证目标实例至少能容纳模型与约 1.5 GB 的推理内存；若免费实例不足，语音功能应通过能力状态关闭，不影响文字和图片翻译。

## 测试

前端：

- MediaRecorder 支持检测和 MIME 选择。
- 开始、手动停止、30 秒自动停止和卸载清理。
- 权限拒绝、无设备、上传失败。
- 转写结果追加而非覆盖，且不会自动发送。
- 录音中和识别中的按钮状态及可访问性名称。

后端：

- multipart 文件必填、类型、大小和时长限制。
- 身份 Cookie 与请求边界。
- sidecar 成功、空结果、超时和不可用错误映射。
- 临时文件在所有退出路径删除。
- 日志和数据库不包含音频内容。

真实验收：

- 中文短句转写并进入输入框。
- 韩文短句转写并进入输入框。
- 静音录音得到明确提示。
- 当前 Codex 内置浏览器、Chrome/Edge 和移动浏览器至少各验证录音上传能力。
- 文字翻译、图片翻译和韩语朗读回归通过。

## 不在本切片范围

- 实时流式字幕。
- 长音频上传和会议转写。
- 用户录音历史。
- 说话人分离、逐词时间戳和音频翻译。
- GPU/CUDA 优化。
