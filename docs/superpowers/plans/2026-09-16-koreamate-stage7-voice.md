# KoreaMate 第七阶段语音输入与韩语朗读实施计划

设计依据：`docs/superpowers/specs/2026-09-16-koreamate-stage7-voice-design.md`

## 任务 1：建立浏览器语音识别边界

涉及文件：

- 新增 `frontend/lib/speech-recognition.ts`
- 新增 `frontend/lib/speech-recognition.test.ts`

实现内容：

1. 定义项目内部使用的 Speech Recognition 最小类型，避免依赖非标准全局类型。
2. 检测 `SpeechRecognition` 和 `webkitSpeechRecognition`。
3. 封装开始、停止、最终结果、错误映射和销毁行为。
4. 不暴露原始音频，也不记录临时识别文本。

验证：

- 支持标准和 WebKit 前缀实现。
- 不支持时返回明确能力状态。
- 权限拒绝、无语音、无麦克风和网络错误映射为中文提示。
- 销毁时停止仍在运行的识别实例。

## 任务 2：把语音输入接入现有翻译输入框

涉及文件：

- 修改 `frontend/components/conversation/conversation-screen.tsx`
- 修改 `frontend/components/conversation/conversation-screen.module.css`
- 修改 `frontend/components/conversation/conversation-screen.test.ts`

实现内容：

1. 仅在 `TRANSLATION` 模式显示麦克风按钮。
2. 点击开始监听，再次点击停止。
3. 根据已有输入是否包含韩文，在 `ko-KR` 和 `zh-CN` 间选择初始识别语言。
4. 将最终识别结果追加到输入框，不覆盖已有文字、不自动发送。
5. 显示“正在听”和错误状态；不支持时禁用按钮并提供可访问性名称。
6. 保持图片附件、Enter 发送和发送按钮行为不变。

验证：

- 点击状态与按钮 `aria-label` 正确。
- 识别结果追加而非覆盖。
- 识别完成后仍需用户主动发送。
- 错误不清空输入框。
- TRAVEL 模式不出现语音按钮。

## 任务 3：增加韩语结果朗读

涉及文件：

- 新增 `frontend/lib/speech-synthesis.ts`
- 新增 `frontend/lib/speech-synthesis.test.ts`
- 修改 `frontend/components/conversation/conversation-screen.tsx`
- 修改 `frontend/components/conversation/conversation-screen.module.css`
- 修改 `frontend/components/conversation/conversation-screen.test.ts`

实现内容：

1. 检测浏览器 Speech Synthesis 能力。
2. 从可用声音中优先选择 `ko-KR`，朗读 `naturalExpression`。
3. 韩语结果显示朗读按钮；中文结果和不支持的浏览器不显示。
4. 播放时按钮切换为停止状态；新播放前取消旧播放。
5. 播放结束、发生错误或组件卸载时恢复状态并清理。

验证：

- 选择韩语声音并设置 `lang="ko-KR"`。
- 点击停止会调用 `speechSynthesis.cancel()`。
- 中文翻译不显示按钮。
- 页面卸载后没有残留朗读。

## 任务 4：回归、浏览器验证与交付

执行：

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run build`
5. 在本地翻译页验证：中文语音转文字、韩文语音转文字、韩语结果朗读、权限拒绝降级。
6. 检查 Git 差异只包含本阶段文件，不包含生成文件或隐私数据。

完成标准：

- 支持的 Chrome/Edge 中可以从同一翻译输入框完成语音识别。
- 识别文字由用户确认后发送，现有翻译 API 无需修改。
- 韩语结果可以开始与停止朗读。
- 不上传、不保存录音。
- 文字翻译、图片翻译和旅行规划测试全部通过。
