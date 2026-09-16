# KoreaMate Whisper

本地 faster-whisper 服务使用多语言 `small` 模型和 CPU INT8 转写中韩语音。

安装：

```powershell
py -3.12 -m venv .venv-whisper
.\.venv-whisper\Scripts\python.exe -m pip install -r infrastructure\whisper\requirements.txt
```

启动：

```powershell
npm run dev:whisper
```

服务监听 `http://127.0.0.1:58020`。第一次转写会下载模型，后续读取用户目录中的 Hugging Face 缓存。
