/**
 * [INPUT]: Vercel Serverless 环境，请求 query.url
 * [OUTPUT]: 返回目标 URL 的 HTML 文本，供前端读者模式解析
 * [POS]: 分屏读者模式的后端代理，绕过 CORS，仅允许 http(s) URL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * 部署到 Vercel 时生效；本地或纯静态部署时前端使用 CORS 代理兜底。
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

function isValidUrl(s) {
    try {
        const u = new URL(s);
        return ALLOWED_PROTOCOLS.includes(u.protocol);
    } catch {
        return false;
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).end();
    }

    const url = req.query.url;
    if (!url || !isValidUrl(url)) {
        return res.status(400).json({ error: 'Missing or invalid url' });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-CG-News-Reader/1.0)',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Upstream error' });
        }

        const html = await response.text();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.status(200).json({ html });
    } catch (e) {
        if (e.name === 'AbortError') {
            return res.status(504).json({ error: 'Timeout' });
        }
        return res.status(502).json({ error: 'Fetch failed' });
    }
}
