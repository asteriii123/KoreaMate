# KoreaMate BGE-M3 Embedding

本地服务使用魔搭下载的 `BAAI/bge-m3` 为中韩文旅游知识生成 1024 维 dense embedding。模型只在第一次 `/embed` 请求时加载；`/health` 不会触发模型下载。

## 安装

```powershell
py -3.12 -m venv .venv-embedding
.\.venv-embedding\Scripts\python.exe -m pip install -r infrastructure\embedding\requirements.txt
```

如果 `py -3.12` 在本机不可用，也可以使用已安装的 Python 3.11 或 3.12 创建虚拟环境。

## 启动

```powershell
npm run dev:embedding
```

服务监听 `http://127.0.0.1:58030`：

- `GET /health`：查看模型、版本、维度和加载状态。
- `POST /embed`：提交 `{ "texts": ["首尔", "서울"] }`。

模型默认下载到 ModelScope 缓存。可用 `EMBEDDING_MODEL_CACHE` 指定持久缓存目录。模型权重不会提交到 Git。

CPU 可以运行，但首次下载和首次加载耗时较长；CUDA 可用时服务自动启用 GPU 与 fp16。

## 知识库诊断与回填

在项目 `.env` 设置一个仅供服务器内部使用的 `INTERNAL_API_KEY` 后，可通过请求头 `x-internal-key` 调用：

- `GET /api/v1/internal/knowledge/status`：只返回知识文档状态数量和模型状态，不返回私人攻略正文。
- `POST /api/v1/internal/knowledge/backfill`：每次为最多 25 个既有地点生成或重试知识向量，可重复调用直到 `remaining` 为 0。

未配置密钥或密钥不匹配时，这两个接口都会拒绝访问。Embedding 服务不可用只会令对应文档进入失败状态，不影响基础旅行规划和翻译功能。

## 测试

测试使用假模型，不下载真实权重：

```powershell
.\.venv-embedding\Scripts\python.exe -m unittest infrastructure\embedding\server_test.py
```
