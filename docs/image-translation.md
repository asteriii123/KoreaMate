# 图片内翻译部署说明

图片翻译会把原图先写入私有对象存储，再执行 OCR、中文翻译和覆盖渲染。开发环境未配置 R2 时使用仓库外的 `.data-image-assets` 本地目录；生产环境必须配置 R2。

必需环境变量：

```ini
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=koreamate-private
INTERNAL_API_KEY=<用于清理任务的随机长密钥>
```

R2 桶必须保持私有，不能设置公开域名。浏览器只通过 `/api/v1/image-assets/:id/original` 和 `/api/v1/image-assets/:id/translated` 读取；服务端校验当前账号或游客身份后才返回内容或五分钟签名地址。

生产镜像需安装 `Noto Sans CJK SC`。每天调用一次 `POST /api/v1/image-assets/internal/cleanup`，请求头 `x-internal-key` 使用 `INTERNAL_API_KEY`，用于清除超过七天的游客图片。登录合并后图片的过期时间会自动清除。

PaddleOCR 第一次启动需要加载本地模型，机器较慢时可能持续数分钟。上线时应在接收流量前启动并预热 OCR 服务。
