/**
 * [INPUT]: 依赖 ky 进行 HTTP 请求
 * [OUTPUT]: 对外提供 client (ky 实例)
 * [POS]: network 的核心 HTTP 客户端，被 api.js 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import ky from 'ky';

// ============================================================
// HTTP 客户端配置
// ============================================================

export const client = ky.create({
    // 基础 URL（根据实际后端地址配置）
    // prefixUrl: 'https://api.example.com',

    // 超时配置
    timeout: 30000,

    // 重试策略
    retry: {
        limit: 2,
        methods: ['get'],
        statusCodes: [408, 429, 500, 502, 503, 504],
    },

    // 请求钩子
    hooks: {
        beforeRequest: [
            // 添加通用请求头
            // (request) => {
            //     request.headers.set('X-Custom-Header', 'value');
            // },
        ],

        afterResponse: [
            // 响应后处理
            // async (request, options, response) => {
            //     // 统一错误处理、日志记录等
            // },
        ],

        beforeError: [
            // 错误增强
            // (error) => {
            //     // 添加额外错误信息
            //     return error;
            // },
        ],
    },
});
