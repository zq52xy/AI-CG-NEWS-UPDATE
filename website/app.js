/**
 * [INPUT]: 依赖 marked.js 进行 Markdown 解析
 * [OUTPUT]: 对外提供新闻展示、历史记录切换功能
 * [POS]: 每日新闻网站的核心逻辑模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================================
//                          配置
// ============================================================================

const CONFIG = {
    // 新闻文件目录（相对于网站根目录）
    newsDir: '../daily_news/',
    // 首页显示的历史记录数量（只检查最近7天）
    historyLimit: 7,
    // 自动刷新间隔（毫秒），0 表示禁用
    autoRefresh: 0
};

// ============================================================================
//                          DOM 元素
// ============================================================================

const elements = {
    content: document.getElementById('content'),
    historyList: document.getElementById('historyList'),
    refreshBtn: document.getElementById('refreshBtn'),
    pageTitle: document.getElementById('pageTitle'),
    currentDate: document.getElementById('currentDate'),
    beijingTime: document.getElementById('beijingTime'),
    status: document.getElementById('status'),
    // 移动端菜单
    menuBtn: document.getElementById('menuBtn'),
    sidebar: document.querySelector('.sidebar'),
    overlay: document.getElementById('sidebarOverlay')
};

// ============================================================================
//                          工具函数
// ============================================================================

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-CN', options);
}

/**
 * 更新北京时间显示
 */
function updateBeijingTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    elements.beijingTime.textContent = `北京时间 ${hours}:${minutes}`;
}

/**
 * 获取今天的日期字符串 YYYY-MM-DD（使用本地时间）
 */
function getTodayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 生成最近 N 天的日期列表（使用本地时间）
 */
function getRecentDates(days) {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    return dates;
}

// ============================================================================
//                          核心功能
// ============================================================================

/**
 * 加载 Markdown 文件
 */
async function loadMarkdown(dateStr) {
    const filename = `${dateStr}.md`;
    const url = `${CONFIG.newsDir}${filename}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`文件不存在: ${filename}`);
        }

        const markdown = await response.text();
        return markdown;

    } catch (error) {
        console.error('加载失败:', error);
        return null;
    }
}

/**
 * 渲染 Markdown 到页面
 */
function renderMarkdown(markdown) {
    if (!markdown) {
        elements.content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3 class="empty-title">暂无内容</h3>
                <p class="empty-desc">该日期的新闻报告尚未生成</p>
            </div>
        `;
        return;
    }

    // 使用 marked.js 解析 Markdown
    const html = marked.parse(markdown);
    elements.content.innerHTML = html;

    // 注入版块 Banner
    injectBanners();

    // 移动端隐藏次要列
    if (window.innerWidth <= 768) {
        hideMobileColumns();
    }

    // 图片加载失败时隐藏
    elements.content.querySelectorAll('img').forEach(img => {
        img.onerror = () => {
            img.style.display = 'none';
        };
    });
}

/**
 * 为版块标题注入 Banner 图片
 */
function injectBanners() {
    const bannerMap = {
        'GitHub Trending': '../img/github.png',
        'CG 图形学': '../img/CG.png',
        'Reddit 讨论': '../img/reddit.png',
        'Hacker News': '../img/Hacker News.png',
        '学术前沿': '../img/arXiv.png',
        'Product Hunt': '../img/product hunt.png'
    };

    const headers = elements.content.querySelectorAll('h2');

    headers.forEach(h2 => {
        const text = h2.textContent;
        let bannerSrc = null;

        for (const [key, src] of Object.entries(bannerMap)) {
            if (text.includes(key)) {
                bannerSrc = src;
                break;
            }
        }

        if (bannerSrc) {
            // 创建容器
            const container = document.createElement('div');
            container.className = 'section-header-container';

            // 创建图片
            const img = document.createElement('img');
            img.src = bannerSrc;
            img.className = 'section-banner';
            img.alt = text;
            img.onerror = () => { img.style.display = 'none'; }; // 容错

            // 创建标题覆盖层
            const overlay = document.createElement('div');
            overlay.className = 'section-header-overlay';

            // 插入 DOM：先插入容器，再移动 h2
            h2.parentNode.insertBefore(container, h2);
            container.appendChild(img);
            container.appendChild(overlay);
            overlay.appendChild(h2);
        }
    });
}

/**
 * 移动端隐藏次要表格列
 * 隐藏: 语言、今日、标记、热度、分数、评论、社区、来源、作者
 * 保留: 项目名/标题、描述/概述、链接
 */
function hideMobileColumns() {
    const hideKeywords = ['今日', '语言', '标记', '热度', '分数', '评论', '社区', '来源', '作者'];

    document.querySelectorAll('.content table').forEach(table => {
        const headers = table.querySelectorAll('th');
        const columnsToHide = [];

        // 找出需要隐藏的列索引
        headers.forEach((th, index) => {
            const text = th.textContent.trim();
            if (hideKeywords.some(keyword => text.includes(keyword))) {
                columnsToHide.push(index);
            }
        });

        // 隐藏对应的列
        if (columnsToHide.length > 0) {
            table.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('th, td');
                columnsToHide.forEach(colIndex => {
                    if (cells[colIndex]) {
                        cells[colIndex].style.display = 'none';
                    }
                });
            });
        }

        // 链接列右对齐
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const lastCell = cells[cells.length - 1];
            if (lastCell) {
                lastCell.style.textAlign = 'right';
            }
        });
    });
}

/**
 * 显示指定日期的新闻
 */
async function showNews(dateStr) {
    // 显示加载状态
    elements.content.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>加载中...</p>
        </div>
    `;

    // 更新当前日期显示
    elements.currentDate.textContent = formatDate(dateStr);

    // 更新侧边栏选中状态
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.toggle('active', item.dataset.date === dateStr);
    });

    // 加载并渲染 Markdown
    const markdown = await loadMarkdown(dateStr);
    renderMarkdown(markdown);

    // 更新 URL hash
    window.location.hash = dateStr;
}

/**
 * 初始化历史记录列表
 */
async function initHistoryList() {
    const dates = getRecentDates(CONFIG.historyLimit);

    // 检查每个日期是否有对应文件
    const availableDates = [];

    for (const dateStr of dates) {
        const url = `${CONFIG.newsDir}${dateStr}.md`;
        try {
            // 使用 GET 请求并检查内容，因为 GitHub Pages 对不存在文件可能返回 HTML 404 页面
            const response = await fetch(url);
            if (response.ok) {
                const text = await response.text();
                // 确保是真正的 Markdown 文件（以 # 开头）
                if (text.trim().startsWith('#')) {
                    availableDates.push(dateStr);
                }
            }
        } catch (e) {
            // 文件不存在或网络错误
        }
    }

    // 渲染历史列表
    elements.historyList.innerHTML = availableDates.length ? '' : `
        <li class="history-item" style="pointer-events: none; color: var(--text-muted);">
            <span class="history-icon">📭</span>
            <span>暂无历史记录</span>
        </li>
    `;

    availableDates.forEach(dateStr => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.dataset.date = dateStr;

        const date = new Date(dateStr);
        const isToday = dateStr === getTodayStr();

        li.innerHTML = `
            <span class="history-icon">${isToday ? '📌' : '📄'}</span>
            <span>${date.getMonth() + 1}月${date.getDate()}日 ${isToday ? '(今天)' : ''}</span>
        `;

        li.addEventListener('click', () => showNews(dateStr));
        elements.historyList.appendChild(li);
    });

    return availableDates;
}

/**
 * 刷新数据
 */
async function refresh() {
    elements.status.textContent = '● 刷新中...';
    elements.status.style.color = 'var(--warning)';

    const dates = await initHistoryList();

    // 显示最新的新闻
    if (dates.length > 0) {
        const hashDate = window.location.hash.slice(1);
        const targetDate = dates.includes(hashDate) ? hashDate : dates[0];
        await showNews(targetDate);
    } else {
        elements.content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3 class="empty-title">暂无新闻</h3>
                <p class="empty-desc">等待每日北京时间 20:00 自动生成新闻报告</p>
            </div>
        `;
    }

    elements.status.textContent = '● 在线';
    elements.status.style.color = 'var(--success)';
}

// ============================================================================
//                          初始化
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 绑定刷新按钮
    elements.refreshBtn.addEventListener('click', refresh);

    // 移动端菜单切换
    const toggleSidebar = (open) => {
        elements.sidebar.classList.toggle('open', open);
        elements.overlay.classList.toggle('active', open);
    };

    // 点击菜单按钮打开侧边栏
    elements.menuBtn.addEventListener('click', () => toggleSidebar(true));

    // 点击遮罩层关闭侧边栏
    elements.overlay.addEventListener('click', () => toggleSidebar(false));

    // 选择日期后自动关闭侧边栏（移动端体验优化）
    elements.historyList.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleSidebar(false);
        }
    });

    // 配置 marked.js
    marked.setOptions({
        gfm: true,
        breaks: true
    });

    // 初始加载
    await refresh();

    // 北京时间更新（每分钟更新一次）
    updateBeijingTime();
    setInterval(updateBeijingTime, 60000);

    // 自动刷新
    if (CONFIG.autoRefresh > 0) {
        setInterval(refresh, CONFIG.autoRefresh);
    }
});

// 处理 URL hash 变化
window.addEventListener('hashchange', () => {
    const dateStr = window.location.hash.slice(1);
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        showNews(dateStr);
    }
});
