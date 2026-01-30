# network/
> L2 | 父级: website/src/CLAUDE.md

HTTP 网络层，基于 ky 构建

## 成员清单

- `index.js`: barrel 导出入口
- `client.js`: ky HTTP 客户端实例，含超时/重试/钩子配置
- `api.js`: 业务 API 定义（联系表单/作品集/统计等）
- `utils.js`: 网络工具函数（错误处理/URL构建）

## 依赖

- [ky](https://github.com/sindresorhus/ky) - HTTP 请求库

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
