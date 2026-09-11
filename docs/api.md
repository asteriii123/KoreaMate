# KoreaMate API

统一前缀为 `/api/v1`，成功响应为 `{ success, data, requestId }`，失败响应为 `{ success, error, requestId }`。

- `POST /translations/text`
- `POST /media-tasks`
- `POST /travel-plans`
- `GET /travel-plans/:id`
- `GET /tasks/:id`、`GET /tasks/:id/events`
- `GET /cities`、`GET /cities/:id`
- `GET /places`、`GET /places/:id`
- `GET /inspirations/search`、`GET /inspirations/trends`
- `GET|POST|DELETE /favorites`
- `GET|DELETE /history`
- `GET /me`

