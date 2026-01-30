/**
 * [INPUT]: 依赖 ./client 的 client 实例
 * [OUTPUT]: 对外提供各业务 API 函数
 * [POS]: network 的 API 层，集中定义所有对外接口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// import { client } from './client';

// ============================================================
// API 定义（按业务模块组织）
// ============================================================

// --- 联系表单 ---
// export const contactApi = {
//     submit: (data) => client.post('contact', { json: data }).json(),
// };

// --- 作品集 ---
// export const portfolioApi = {
//     list: () => client.get('portfolio').json(),
//     get: (id) => client.get(`portfolio/${id}`).json(),
// };

// --- 访问统计 ---
// export const analyticsApi = {
//     track: (event) => client.post('analytics', { json: event }),
// };
