# PaddleOCR MCP

KoreaMate 使用本地 PaddleOCR MCP 提取韩文图片文字。模型与 Python 虚拟环境不提交到 Git。

Windows 开发环境：

```powershell
py -3.12 -m venv .venv-ocr
.\.venv-ocr\Scripts\python.exe -m pip install -r infrastructure\paddleocr\requirements.txt
```

启动：

```powershell
npm run dev:ocr
```

MCP 地址为 `http://127.0.0.1:58010/mcp`。

同时启动网页、API 和 OCR：

```powershell
npm run dev:all
```

首次识别时会自动下载检测与韩文识别模型，后续使用本地缓存。
