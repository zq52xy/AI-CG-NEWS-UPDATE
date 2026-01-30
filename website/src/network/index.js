/**
 * [INPUT]: 依赖 ./client, ./api, ./utils
 * [OUTPUT]: 统一导出 network 模块所有公开接口
 * [POS]: network 的 barrel 导出入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================
// Barrel Export
// ============================================================

export { client } from './client';
// export { contactApi, portfolioApi, analyticsApi } from './api';
// export { handleApiError, buildUrl } from './utils';
