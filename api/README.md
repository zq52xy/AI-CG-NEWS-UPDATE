# API（Vercel Serverless）

部署到 Vercel 时，`/api/reader` 会作为代理拉取目标 URL 的 HTML，供前端读者模式使用。

- **GET /api/reader?url=...**：返回 `{ html }`。仅允许 `http`/`https`，防 SSRF。
- 未部署时前端自动使用 CORS 代理兜底（allorigins.win）。
