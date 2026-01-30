/**
 * [INPUT]: 依赖 marked.js 进行 Markdown 解析
 * [OUTPUT]: 对外提供新闻展示、历史记录切换功能
 * [POS]: 每日新闻网站的核心逻辑模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================================
//                          配置
// ============================================================================

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
//                          数据管理 - 收藏夾核心 (L2 Essential)
// ============================================================================

class FavoritesManager {
    static STORAGE_KEY = 'aicg_news_favorites';

    static get() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    static add(item) {
        const list = this.get();
        // 核心哲学：URL是唯一真理，通过URL去重
        if (!list.some(i => i.url === item.url)) {
            list.unshift(item); // 新增在头部
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            return true;
        }
        return false;
    }

    static remove(url) {
        const list = this.get();
        const newList = list.filter(i => i.url !== url);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newList));
    }

    static isFavorite(url) {
        const list = this.get();
        return list.some(i => i.url === url);
    }

    static update(url, updates) {
        const list = this.get();
        const index = list.findIndex(i => i.url === url);
        if (index !== -1) {
            list[index] = { ...list[index], ...updates };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            return true;
        }
        return false;
    }
}

// ============================================================================
//                          UI 组件 - 模态框管理 (L2 Component)
// ============================================================================

class ModalManager {
    static overlay = document.getElementById('modalOverlay');
    static editModal = document.getElementById('editModal');
    static deleteModal = document.getElementById('deleteModal');

    // Edit Inputs
    static editTitle = document.getElementById('editTitleInput');
    static editNote = document.getElementById('editNoteInput');
    static editSaveBtn = document.getElementById('editSaveBtn');
    static editCancelBtn = document.getElementById('editCancelBtn');

    // Delete Buttons
    static deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    static deleteCancelBtn = document.getElementById('deleteCancelBtn');

    // Callbacks
    static onSave = null;
    static onDelete = null;

    static init() {
        // Edit Handlers
        if (this.editCancelBtn) this.editCancelBtn.onclick = () => this.close();
        if (this.editSaveBtn) this.editSaveBtn.onclick = () => {
            if (this.onSave) {
                this.onSave({
                    title: this.editTitle.value.trim(),
                    note: this.editNote.value.trim()
                });
            }
            this.close();
        };

        // Delete Handlers
        if (this.deleteCancelBtn) this.deleteCancelBtn.onclick = () => this.close();
        if (this.deleteConfirmBtn) this.deleteConfirmBtn.onclick = () => {
            if (this.onDelete) this.onDelete();
            this.close();
        };

        // Click outside to close
        if (this.overlay) {
            this.overlay.onclick = (e) => {
                if (e.target === this.overlay) this.close();
            };
        }

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    static openEdit(item, onSave) {
        if (!this.editTitle || !this.editNote) return;
        this.editTitle.value = item.title || '';
        this.editNote.value = item.note || '';
        this.onSave = onSave;

        this.show(this.editModal);
        this.editTitle.focus();
    }

    static openDelete(onDelete) {
        this.onDelete = onDelete;
        this.show(this.deleteModal);
    }

    static show(modal) {
        if (!modal || !this.overlay) return;
        // Hide all first
        this.editModal.classList.add('hidden');
        this.deleteModal.classList.add('hidden');

        // Show target
        modal.classList.remove('hidden');

        // Show overlay with animation
        this.overlay.classList.remove('hidden');
        // Small delay to allow CSS transition
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });
    }

    static close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
        }, 300);
    }
}

// ============================================================================
//                          DOM 元素
// ============================================================================

const elements = {
    content: document.getElementById('content'),
    historyList: document.getElementById('historyList'),
    favList: document.getElementById('favList'),
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

    // 注入收藏按钮
    injectFavoriteButtons();

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
 * 注入收藏按钮到新闻卡片
 */
function injectFavoriteButtons() {
    // 2. 处理新闻卡片 (Card Layout)
    const cards = elements.content.querySelectorAll('.news-card');
    cards.forEach(card => {
        const link = card.querySelector('.news-title-link');
        if (!link) return;

        const titleEl = card.querySelector('.news-title');
        const title = titleEl ? titleEl.textContent.trim() : '未命名新闻';
        const url = link.href;

        // 注入到 Card Header 中
        const header = card.querySelector('.news-card-header');
        if (header) {
            // 简单的 flex 布局调整，确保星星在最右侧
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';

            // 检查之前是否已经注入，如果有则更新状态
            const existingBtn = header.querySelector('.fav-btn');
            if (existingBtn) {
                const isFav = FavoritesManager.isFavorite(url);
                existingBtn.className = 'fav-btn ' + (isFav ? 'active' : '');
                existingBtn.innerHTML = isFav ? '★' : '☆';
                return;
            }

            injectBtn(header, url, title);
        }
    });

    /**
     * 通用注入逻辑
     */
    function injectBtn(container, url, title) {
        const date = elements.currentDate.innerText;
        const btn = document.createElement('button');
        btn.className = 'fav-btn ' + (FavoritesManager.isFavorite(url) ? 'active' : '');
        btn.innerHTML = btn.classList.contains('active') ? '★' : '☆';
        btn.title = '收藏此链接';

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (FavoritesManager.isFavorite(url)) {
                FavoritesManager.remove(url);
                btn.classList.remove('active');
                btn.innerHTML = '☆';
            } else {
                FavoritesManager.add({ title, url, date });
                btn.classList.add('active');
                btn.innerHTML = '★';

                btn.style.transform = 'scale(1.2)';
                setTimeout(() => btn.style.transform = 'scale(1)', 200);
            }
            renderFavoritesSidebar();
        };

        // 卡片模式下，append 到 header 末尾
        btn.style.fontSize = '1.2rem';
        container.appendChild(btn);
    }
}

/**
 * 渲染侧边栏收藏列表
 */
function renderFavoritesSidebar() {
    const list = FavoritesManager.get();

    // 如果没有元素，不显示或显示空状态，这里选择显示空状态
    if (!elements.favList) return;

    if (list.length === 0) {
        elements.favList.innerHTML = `
            <li class="history-item" style="pointer-events: none; color: var(--text-muted); padding:10px 20px;">
                <span style="font-size:1.2em;">☆</span>
                <span style="margin-left:8px; font-size:0.9em;">暂无收藏</span>
            </li>
        `;
        return;
    }

    elements.favList.innerHTML = '';
    list.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item fav-item';
        li.style.flexDirection = 'column';
        li.style.alignItems = 'flex-start';
        li.style.gap = '4px';

        // 头部行：星星 + 标题 + 操作区
        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.width = '100%';
        topRow.style.gap = '8px';

        const titleSpan = document.createElement('span');
        titleSpan.style.flex = '1';
        titleSpan.style.whiteSpace = 'nowrap';
        titleSpan.style.overflow = 'hidden';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.style.fontWeight = '500';
        titleSpan.style.cursor = 'pointer'; // 只有标题可点击
        titleSpan.className = 'fav-title-link'; // 添加类名以便可能的CSS控制
        titleSpan.textContent = item.title;
        titleSpan.title = `${item.title} (点击打开)`;

        // 点击标题跳转
        titleSpan.onclick = (e) => {
            e.stopPropagation();
            window.open(item.url, '_blank');
        };
        // hover效果通过CSS或简单的JS实现
        titleSpan.onmouseover = () => titleSpan.style.textDecoration = 'underline';
        titleSpan.onmouseout = () => titleSpan.style.textDecoration = 'none';


        topRow.innerHTML = `<span style="color: #f1c40f;">★</span>`;
        topRow.appendChild(titleSpan);

        // 编辑按钮 (铅笔)
        const editBtn = document.createElement('span');
        editBtn.innerHTML = '✏️';
        editBtn.title = '编辑标题/备注';
        editBtn.style.cursor = 'pointer';
        editBtn.style.fontSize = '0.9em';
        editBtn.style.opacity = '0.5';
        editBtn.style.transition = 'opacity 0.2s';
        editBtn.style.padding = '4px'; // 增加一点内边距方便点击
        editBtn.onmouseover = () => editBtn.style.opacity = '1';
        editBtn.onmouseout = () => editBtn.style.opacity = '0.5';

        editBtn.onclick = (e) => {
            e.stopPropagation();
            // 使用新模态框
            ModalManager.openEdit(item, (newData) => {
                if (newData.title) {
                    FavoritesManager.update(item.url, newData);
                    renderFavoritesSidebar();
                }
            });
        };

        // 删除按钮 (叉号)
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '×';
        delBtn.title = '删除收藏';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '1.2em';
        delBtn.style.fontWeight = 'bold';
        delBtn.style.color = '#e74c3c';
        delBtn.style.marginLeft = '4px';
        delBtn.style.opacity = '0.5';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            // 使用新模态框
            ModalManager.openDelete(() => {
                FavoritesManager.remove(item.url);
                renderFavoritesSidebar();
                injectFavoriteButtons();
            });
        };

        topRow.appendChild(editBtn);
        topRow.appendChild(delBtn);

        // 第二行：日期
        const dateSpan = document.createElement('span');
        dateSpan.textContent = item.date || '未知日期';
        dateSpan.style.fontSize = '0.75rem';
        dateSpan.style.opacity = '0.6';
        dateSpan.style.paddingLeft = '24px';

        li.appendChild(topRow);
        li.appendChild(dateSpan);

        // 第三行：备注 (如果有)
        if (item.note) {
            const noteDiv = document.createElement('div');
            noteDiv.style.fontSize = '0.75rem';
            noteDiv.style.color = '#888';
            noteDiv.style.paddingLeft = '24px';
            noteDiv.style.fontStyle = 'italic';
            noteDiv.style.marginTop = '-2px';
            noteDiv.textContent = `📝 ${item.note}`;
            li.appendChild(noteDiv);
        }

        // 移除 li.onclick，防止误触
        elements.favList.appendChild(li);
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
        'Product Hunt': '../img/product hunt.png',
        'Hugging Face': '../img/Hugging Face.png',
        'Trending Skills': '../img/skills.png'
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

            // 查找现有的 Markdown 图片 (通常在 h2 紧邻的 p 标签中)
            let img = null;
            let imgParentToRemove = null; // 保存需要删除的父元素
            const nextEl = h2.nextElementSibling;
            if (nextEl && nextEl.tagName === 'P') {
                const existingImg = nextEl.querySelector('img');
                // 检查：如果存在图片，就使用它并标记父元素待删除
                if (existingImg) {
                    img = existingImg;
                    imgParentToRemove = nextEl; // 保存引用，稍后删除
                }
            }

            // 如果没有现有图片，则创建新图片
            if (!img) {
                img = document.createElement('img');
                img.src = bannerSrc;
                img.alt = text;
            }

            img.className = 'section-banner';
            img.onerror = () => { img.style.display = 'none'; }; // 容错

            // 创建标题覆盖层
            const overlay = document.createElement('div');
            overlay.className = 'section-header-overlay';

            // 插入 DOM：
            // 1. 在 h2 前插入容器
            h2.parentNode.insertBefore(container, h2);
            // 2. 将图片移入容器
            container.appendChild(img);
            // 3. 将 overlay 移入容器
            container.appendChild(overlay);
            // 4. 将 h2 移入 overlay
            overlay.appendChild(h2);

            // 删除原 Markdown 图片的父 P 标签（因为图片已移走，P 现在是空的或只剩空白）
            if (imgParentToRemove) {
                imgParentToRemove.remove();
            }
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
    // 初始化 ModalManager
    ModalManager.init();

    // 绑定刷新按钮
    elements.refreshBtn.addEventListener('click', refresh);

    // 初始化收藏栏
    renderFavoritesSidebar();

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

// ============================================================================
//                          分屏预览系统 (Split Screen Preview)
// ============================================================================

/**
 * 分屏预览管理器
 * 实现点击链接后在右侧显示 iframe 预览
 */
class PreviewManager {
    static contentWrapper = document.getElementById('contentWrapper');
    static splitDivider = document.getElementById('splitDivider');
    static previewPanel = document.getElementById('previewPanel');
    static previewUrl = document.getElementById('previewUrl');
    static previewIframe = document.getElementById('previewIframe');
    static previewLoading = document.getElementById('previewLoading');
    static previewError = document.getElementById('previewError');
    static previewOpenBtn = document.getElementById('previewOpenBtn');
    static previewCloseBtn = document.getElementById('previewCloseBtn');
    static previewErrorOpenBtn = document.getElementById('previewErrorOpenBtn');

    static previewSpecial = document.getElementById('previewSpecial');
    static specialPdfBtn = document.getElementById('specialPdfBtn');
    static specialAbsBtn = document.getElementById('specialAbsBtn');

    static currentUrl = null;
    static isDragging = false;
    static splitRatio = 0.5; // 默认 50:50
    static loadTimeoutId = null; // 加载超时定时器引用

    static init() {
        if (!this.contentWrapper) return;

        // 关闭按钮
        if (this.previewCloseBtn) {
            this.previewCloseBtn.addEventListener('click', () => this.close());
        }

        // 新标签打开按钮
        if (this.previewOpenBtn) {
            this.previewOpenBtn.addEventListener('click', () => this.openInNewTab());
        }
        if (this.previewErrorOpenBtn) {
            this.previewErrorOpenBtn.addEventListener('click', () => this.openInNewTab());
        }

        // 特殊预览按钮
        if (this.specialPdfBtn) {
            this.specialPdfBtn.addEventListener('click', () => {
                if (this.currentUrl) {
                    // 转为 PDF 链接打开
                    let pdfUrl = this.currentUrl.replace('/abs/', '/pdf/').replace('/html/', '/pdf/');
                    if (!pdfUrl.endsWith('.pdf')) pdfUrl += '.pdf';
                    window.open(pdfUrl, '_blank');
                }
            });
        }
        if (this.specialAbsBtn) {
            this.specialAbsBtn.addEventListener('click', () => {
                if (this.currentUrl) {
                    // 转为摘要链接打开
                    let absUrl = this.currentUrl.replace('/pdf/', '/abs/').replace('.pdf', '');
                    window.open(absUrl, '_blank');
                }
            });
        }

        // iframe 加载事件
        if (this.previewIframe) {
            this.previewIframe.addEventListener('load', () => this.onIframeLoad());
            this.previewIframe.addEventListener('error', () => this.showError());
        }

        // 拖拽分隔线
        this.initDraggable();

        // 拦截内容区域的链接点击
        this.interceptLinks();

        console.log('[PreviewManager] 初始化完成');
    }

    /**
     * 拦截内容区域的链接点击
     */
    static interceptLinks() {
        const content = document.getElementById('content');
        if (!content) return;

        content.addEventListener('click', (e) => {
            // 查找最近的 <a> 标签
            const link = e.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            // 只拦截外部链接（http/https 开头）
            if (!href || !href.startsWith('http')) return;

            // 阻止默认跳转
            e.preventDefault();
            e.stopPropagation();

            // 提取标题 (text content or title attribute)
            const title = link.textContent.trim() || link.title || '无标题';

            // 打开预览
            this.open(href, title);
        });
    }

    /**
     * 打开预览
     */
    static open(url, title = null) {
        if (!url) return;

        this.currentUrl = url;

        // 更新 URL 显示
        if (this.previewUrl) {
            this.previewUrl.textContent = url;
            this.previewUrl.title = url;
        }

        // 进入分屏模式
        this.contentWrapper.classList.add('split-mode');
        this.applySplitRatio();

        // 检测 arXiv
        if (url.includes('arxiv.org/')) {
            this.showSpecial(title);
            return;
        }

        // 检测是否可在 iframe 中预览 (黑名单)
        if (!this.isEmbeddable(url)) {
            this.showError();
            return;
        }

        // 普通链接：使用 iframe
        if (this.previewIframe) {
            this.previewIframe.src = 'about:blank';
        }

        this.showLoading();
        this.hideError();
        this.hideSpecial();

        // 延迟加载新 URL
        if (this.previewIframe) {
            // 清除之前的超时定时器
            if (this.loadTimeoutId) {
                clearTimeout(this.loadTimeoutId);
                this.loadTimeoutId = null;
            }

            setTimeout(() => {
                this.previewIframe.src = url;

                // 5秒超时检测 - 改进逻辑：只有当仍处于加载状态且不是特殊状态时显示错误
                this.loadTimeoutId = setTimeout(() => {
                    // 检查是否仍处于加载状态（loading显示，error和special都隐藏）
                    const isLoading = !this.previewLoading.classList.contains('hidden');
                    const isErrorVisible = !this.previewError.classList.contains('hidden');
                    const isSpecialVisible = !this.previewSpecial.classList.contains('hidden');
                    
                    // 只有当确实在加载中，且没有显示错误/特殊状态时，才显示错误
                    if (isLoading && !isErrorVisible && !isSpecialVisible) {
                        this.showError();
                    }
                    this.loadTimeoutId = null;
                }, 5000);
            }, 50);
        }
    }

    /**
     * 判断网站是否支持嵌入 (黑名单机制)
     */
    static isEmbeddable(url) {
        const blockedDomains = [
            'github.com',
            'github.io',
            'reddit.com',
            'twitter.com',
            'x.com',
            'youtube.com',
            'medium.com',
            'zhihu.com',
            'juejin.cn',
            'bilibili.com',
            'stackoverflow.com',
            'v2ex.com',
            'news.ycombinator.com', // HN usually blocks
            'producthunt.com'
        ];
        try {
            const hostname = new URL(url).hostname;
            return !blockedDomains.some(domain => hostname.includes(domain));
        } catch (e) {
            return true; // 解析失败则默认尝试加载
        }
    }

    static close() {
        this.contentWrapper.classList.remove('split-mode');
        this.currentUrl = null;
        if (this.previewIframe) this.previewIframe.src = 'about:blank';
        // 重置样式
        const content = this.contentWrapper.querySelector('.content');
        if (content) content.style.flex = '';

        // 恢复标题栏状态
        document.title = 'AI & CG 每日资讯';

        // 清除超时定时器
        if (this.loadTimeoutId) {
            clearTimeout(this.loadTimeoutId);
            this.loadTimeoutId = null;
        }
    }

    static openInNewTab() {
        if (this.currentUrl) {
            window.open(this.currentUrl, '_blank');
        }
    }

    static onIframeLoad() {
        this.hideLoading();
        // iframe 加载成功
        console.log('[PreviewManager] Iframe loaded:', this.currentUrl);
    }

    static showLoading() {
        if (this.previewLoading) {
            this.previewLoading.classList.remove('hidden');
            // 可以在加载时显示"在新标签页打开"的提示
            const p = this.previewLoading.querySelector('p');
            if (p) {
                p.innerHTML = '加载中... <br><span style="font-size:0.8em; opacity:0.7; cursor:pointer; text-decoration:underline;">点此在新标签页打开</span>';
                p.querySelector('span').onclick = () => this.openInNewTab();
            }
        }
        if (this.previewIframe) {
            this.previewIframe.classList.add('loading-blur');
            // 确保 iframe 是显示的（被 hideSpecial 等可能会隐藏）
            this.previewIframe.style.display = 'block';
        }
    }

    static hideLoading() {
        if (this.previewLoading) this.previewLoading.classList.add('hidden');
        if (this.previewIframe) this.previewIframe.classList.remove('loading-blur');
    }

    static showError() {
        this.hideLoading();
        if (this.previewIframe) this.previewIframe.style.display = 'none';
        if (this.previewError) this.previewError.classList.remove('hidden');
    }

    static hideError() {
        if (this.previewError) this.previewError.classList.add('hidden');
        if (this.previewIframe) this.previewIframe.style.display = 'block';
    }

    /**
     * 显示特殊状态 (ArXiv)
     */
    static showSpecial(title) {
        if (this.previewLoading) this.previewLoading.classList.add('hidden');
        if (this.previewError) this.previewError.classList.add('hidden');
        if (this.previewIframe) this.previewIframe.style.display = 'none';

        if (this.previewSpecial) {
            this.previewSpecial.classList.remove('hidden');
            // 更新标题
            const titleEl = this.previewSpecial.querySelector('.preview-special-title');
            if (titleEl) {
                titleEl.textContent = title || 'ArXiv 论文';
            }
        }
    }

    static hideSpecial() {
        if (this.previewSpecial) this.previewSpecial.classList.add('hidden');
        if (this.previewIframe) this.previewIframe.style.display = 'block';
    }

    /**
     * 初始化拖拽分隔线
     */
    static initDraggable() {
        if (!this.splitDivider) return;

        const onMouseDown = (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.splitDivider.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;

            const wrapperRect = this.contentWrapper.getBoundingClientRect();
            const x = e.clientX - wrapperRect.left;
            const ratio = x / wrapperRect.width;

            // 限制比例范围 (20% - 80%)
            this.splitRatio = Math.max(0.2, Math.min(0.8, ratio));
            this.applySplitRatio();
        };

        const onMouseUp = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.splitDivider.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // 保存比例到 localStorage
            localStorage.setItem('preview_split_ratio', this.splitRatio.toString());
        };

        // 从 localStorage 恢复比例
        const savedRatio = localStorage.getItem('preview_split_ratio');
        if (savedRatio) {
            this.splitRatio = parseFloat(savedRatio);
        }

        this.splitDivider.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // 触摸屏支持
        this.splitDivider.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.splitDivider.classList.add('dragging');
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const touch = e.touches[0];
            const wrapperRect = this.contentWrapper.getBoundingClientRect();
            const x = touch.clientX - wrapperRect.left;
            const ratio = x / wrapperRect.width;
            this.splitRatio = Math.max(0.2, Math.min(0.8, ratio));
            this.applySplitRatio();
        });

        document.addEventListener('touchend', onMouseUp);
    }

    /**
     * 应用分屏比例
     */
    static applySplitRatio() {
        const content = this.contentWrapper.querySelector('.content');
        if (content) {
            content.style.flex = `0 0 ${this.splitRatio * 100}%`;
        }
    }
}

// 初始化预览管理器
document.addEventListener('DOMContentLoaded', () => {
    PreviewManager.init();
});
