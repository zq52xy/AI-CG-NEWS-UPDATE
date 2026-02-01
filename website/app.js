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
//                          P3: 深色模式管理 (Theme Manager)
// ============================================================================

/**
 * 主题管理器
 * 功能：浅色/深色模式切换，自动跟随系统，localStorage 持久化
 * 存储键：aicg_news_theme，值：'light' | 'dark' | 'auto'
 */
class ThemeManager {
    static STORAGE_KEY = 'aicg_news_theme';

    /**
     * 初始化主题
     * 优先级：localStorage > 系统偏好 > 默认浅色
     */
    static init() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);

        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        // 如果是 'auto' 或未设置，CSS 会自动跟随系统偏好

        // 绑定切换按钮
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        console.log('[ThemeManager] 初始化完成, 当前主题:', this.getCurrentTheme());
    }

    /**
     * 获取当前主题
     */
    static getCurrentTheme() {
        const dataTheme = document.documentElement.getAttribute('data-theme');
        if (dataTheme) return dataTheme;

        // 检查系统偏好
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * 切换主题
     */
    static toggle() {
        const current = this.getCurrentTheme();
        const newTheme = current === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.STORAGE_KEY, newTheme);

        console.log('[ThemeManager] 切换主题:', current, '->', newTheme);
    }

    /**
     * 设置主题
     * @param {'light' | 'dark' | 'auto'} theme
     */
    static set(theme) {
        if (theme === 'auto') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.removeItem(this.STORAGE_KEY);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
    }
}

// ============================================================================
//                          行为设计 - Phase 1: 连续打开天数追踪 (Behavioral Design)
// ============================================================================

/**
 * 连续打开天数管理器
 * 行为原理：损失厌恶 (Loss Aversion) + 习惯可见化
 * 存储：localStorage { lastVisitDate: 'YYYY-MM-DD', streakDays: number }
 */
class StreakManager {
    static STORAGE_KEY = 'aicg_news_streak';

    /**
     * 获取当前 streak 数据
     */
    static get() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : { lastVisitDate: null, streakDays: 0 };
    }

    /**
     * 更新 streak 状态（每次打开时调用）
     * 返回: { streakDays, isNewDay, message }
     */
    static update() {
        const today = getTodayStr();
        const { lastVisitDate, streakDays } = this.get();

        let newStreak = streakDays;
        let isNewDay = false;
        let message = '';

        if (!lastVisitDate) {
            // 首次访问
            newStreak = 1;
            isNewDay = true;
            message = '欢迎！这是你的第一天';
        } else if (lastVisitDate === today) {
            // 今天已经访问过，保持 streak
            newStreak = streakDays;
            isNewDay = false;
        } else {
            // 检查是否是连续天
            const lastDate = new Date(lastVisitDate);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // 连续打开
                newStreak = streakDays + 1;
                isNewDay = true;
                if (newStreak === 7) {
                    message = '🎉 已连续打开 7 天';
                } else if (newStreak === 3) {
                    message = '✨ 已连续打开 3 天';
                }
            } else {
                // 断开了，重新计数（不惩罚，仅重置）
                newStreak = 1;
                isNewDay = true;
            }
        }

        // 保存更新后的数据
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            lastVisitDate: today,
            streakDays: newStreak
        }));

        return { streakDays: newStreak, isNewDay, message };
    }

    /**
     * 获取显示文案
     */
    static getDisplayText() {
        const { streakDays } = this.get();
        if (streakDays <= 0) return '';
        return `已连续打开 ${streakDays} 天`;
    }
}

/**
 * 今日状态管理器
 * 行为原理：现时偏好 (Present Bias) - 强化「今天」的感知
 */
class TodayStatusManager {
    static currentNewsCount = 0;

    /**
     * 设置当日新闻数量
     */
    static setCount(count) {
        this.currentNewsCount = count;
    }

    /**
     * 获取今日状态文案
     * @param {boolean} isToday - 当前查看的是否是今天
     */
    static getStatusText(isToday) {
        if (!isToday) return '';
        const count = this.currentNewsCount;
        if (count > 0) {
            return `今日 · ${count} 条`;
        }
        return '今日 · 已更新';
    }

    /**
     * 从 DOM 中计算新闻数量
     */
    static countFromDOM() {
        const cards = document.querySelectorAll('#content .news-card');
        this.currentNewsCount = cards.length;
        return this.currentNewsCount;
    }
}

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

    // Wrap tables for responsive scrolling
    elements.content.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });

    // 注入版块 Banner
    injectBanners();

    // 注入收藏按钮
    injectFavoriteButtons();

    // 渲染标签云（从新闻卡片提取标签）
    TagFilterManager.render();

    // 移动端隐藏次要列
    if (window.innerWidth <= 768) {
        hideMobileColumns();
    }

    // =========================================
    // Phase 1 增强功能
    // =========================================

    // 1. HTML 内容消毒
    sanitizeNewsContent();

    // 2. 图片容错增强
    enhanceImages();

    // 3. 版块快速导航
    initSectionNav();
}

// ============================================================================
//                          Phase 1: HTML 内容消毒
// ============================================================================

/**
 * 消毒新闻内容，防止损坏的 HTML 标签破坏 UI
 */
function sanitizeNewsContent() {
    // 1. 移除所有 script 标签（安全防护）
    document.querySelectorAll('#content script').forEach(el => el.remove());

    // 2. 修复 news-summary 中的损坏 img 标签
    document.querySelectorAll('.news-summary').forEach(summary => {
        const html = summary.innerHTML;
        // 检测包含 <img 但没有正确闭合的情况
        if (html.includes('<img') && !html.includes('/>') && !html.match(/<img[^>]+>/)) {
            summary.innerHTML = ''; // 清空损坏内容
            console.warn('[Sanitize] Removed broken img tag in news-summary');
        }
        // 检测 style 属性未闭合的情况
        if (html.includes('style="') && (html.match(/style="/g) || []).length > (html.match(/style="[^"]*"/g) || []).length) {
            summary.innerHTML = '';
            console.warn('[Sanitize] Removed unclosed style attribute');
        }
    });

    // 3. 移除危险事件属性
    document.querySelectorAll('#content [onclick], #content [onerror], #content [onload]').forEach(el => {
        el.removeAttribute('onclick');
        el.removeAttribute('onerror');
        el.removeAttribute('onload');
    });
}

// ============================================================================
//                          Phase 1: 图片容错增强
// ============================================================================

/**
 * 增强图片加载处理：懒加载 + 错误降级
 */
function enhanceImages() {
    const images = elements.content.querySelectorAll('img');

    images.forEach(img => {
        // 1. 启用浏览器原生懒加载
        img.loading = 'lazy';

        // 2. 设置默认尺寸防止布局抖动
        if (!img.style.minHeight && !img.height) {
            img.style.minHeight = '80px';
        }

        // 3. 加载失败时优雅降级
        img.onerror = () => {
            img.style.display = 'none';
            // 如果父容器是 news-summary 且只有这一个 img，清空容器
            const parent = img.closest('.news-summary');
            if (parent && parent.querySelectorAll('img').length === 1 && !parent.textContent.trim()) {
                parent.innerHTML = '';
            }
        };

        // 4. 加载成功后移除最小高度限制
        img.onload = () => {
            img.style.minHeight = '';
        };
    });

    // 5. 处理 .news-card-image 背景图片加载
    enhanceCardBackgroundImages();
}

/**
 * 增强 .news-card-image 背景图片处理
 * 检测背景图片是否能加载，失败时隐藏该元素
 */
function enhanceCardBackgroundImages() {
    const cardImages = elements.content.querySelectorAll('.news-card-image');

    cardImages.forEach(cardImage => {
        const style = cardImage.getAttribute('style') || '';
        const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);

        if (!urlMatch || !urlMatch[1]) {
            // URL 为空，直接隐藏
            cardImage.classList.add('hidden');
            cardImage.closest('.news-card')?.classList.remove('has-image');
            return;
        }

        const imageUrl = urlMatch[1];

        // 使用 Image 预加载来检测图片是否能加载
        const testImg = new Image();

        testImg.onload = () => {
            // 图片加载成功，确保显示
            cardImage.classList.remove('hidden');
        };

        testImg.onerror = () => {
            // 图片加载失败，隐藏元素并移除 has-image 类
            cardImage.classList.add('hidden');
            const card = cardImage.closest('.news-card');
            if (card) {
                card.classList.remove('has-image');
            }
            console.warn('[CardImage] Failed to load:', imageUrl);
        };

        testImg.src = imageUrl;
    });
}

// ============================================================================
//                          Phase 1: 版块快速导航
// ============================================================================

// 版块名称映射（简化显示）
const SECTION_NAV_NAMES = {
    'GitHub Trending': 'GitHub',
    'Trending Skills': 'Skills',
    'Hugging Face': 'Hugging Face',
    'Product Hunt': 'Product Hunt',
    'CG 图形学': 'CG 图形',
    'Hacker News': 'Hacker News',
    '学术前沿': '学术前沿',
    'arXiv': 'arXiv'
};

/**
 * 初始化版块快速导航（高冷极简文字版）
 */
function initSectionNav() {
    const nav = document.getElementById('sectionNav');
    if (!nav) return;

    // 获取所有版块标题 (h2)
    const sections = document.querySelectorAll('#content h2');
    if (sections.length === 0) {
        nav.style.display = 'none';
        return;
    }

    nav.innerHTML = '';

    sections.forEach((section, index) => {
        const text = section.textContent;

        // 匹配简化名称
        let displayName = text.slice(0, 12);
        for (const [key, value] of Object.entries(SECTION_NAV_NAMES)) {
            if (text.includes(key)) {
                displayName = value;
                break;
            }
        }

        // 创建导航按钮（纯文字）
        const btn = document.createElement('button');
        btn.className = 'section-nav-item';
        btn.textContent = displayName;
        btn.dataset.index = index;
        btn.setAttribute('aria-label', `跳转到 ${displayName}`);

        // 点击平滑滚动
        btn.onclick = () => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        nav.appendChild(btn);
    });

    // 获取正确的滚动容器（分屏模式下是 #content，非分屏是 #contentWrapper）
    const getScrollContainer = () => {
        const wrapper = document.getElementById('contentWrapper');
        const content = document.getElementById('content');
        // 检查分屏模式：wrapper 有 split-mode 类时，content 是滚动容器
        if (wrapper && wrapper.classList.contains('split-mode')) {
            return content;
        }
        return wrapper;
    };

    // 滚动事件处理函数
    let ticking = false;
    const handleScroll = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const container = getScrollContainer();
                if (container) {
                    updateActiveSection(sections, nav, container);
                }
                ticking = false;
            });
            ticking = true;
        }
    };

    // 同时监听两个可能的滚动容器
    const wrapper = document.getElementById('contentWrapper');
    const content = document.getElementById('content');

    if (wrapper) {
        wrapper.addEventListener('scroll', handleScroll);
    }
    if (content) {
        content.addEventListener('scroll', handleScroll);
    }

    // 初始化高亮
    const container = getScrollContainer();
    if (container) {
        updateActiveSection(sections, nav, container);
    }
}

/**
 * 更新当前活跃版块的高亮状态
 * @param {NodeList} sections - 版块标题元素列表
 * @param {HTMLElement} nav - 导航容器
 * @param {HTMLElement} container - 滚动容器（分屏模式下是 #content，非分屏是 #contentWrapper）
 */
function updateActiveSection(sections, nav, container) {
    if (!container) return;

    const containerHeight = container.clientHeight;

    let activeIndex = 0;

    sections.forEach((section, i) => {
        // 计算相对于容器的位置
        const rect = section.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        // 当版块标题进入视口上半部分时激活
        if (relativeTop <= containerHeight * 0.4) {
            activeIndex = i;
        }
    });

    // 更新导航项状态
    nav.querySelectorAll('.section-nav-item').forEach((item, i) => {
        item.classList.toggle('active', i === activeIndex);
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
 * 获取骨架屏 HTML
 */
function getSkeletonHTML() {
    return `
        <div class="loading" id="loadingSkeleton">
            <!-- Section 1 -->
            <div class="skeleton-section">
                <div class="skeleton-section-header"></div>
                <div class="skeleton-grid">
                    <div class="skeleton-card">
                        <div class="skeleton-card-image"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-card-header">
                                <div class="skeleton-tag"></div>
                            </div>
                            <div class="skeleton-title"></div>
                            <div class="skeleton-desc"></div>
                            <div class="skeleton-desc short"></div>
                        </div>
                    </div>
                    <div class="skeleton-card">
                        <div class="skeleton-card-image"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-card-header">
                                <div class="skeleton-tag"></div>
                            </div>
                            <div class="skeleton-title short"></div>
                            <div class="skeleton-desc"></div>
                            <div class="skeleton-desc"></div>
                        </div>
                    </div>
                    <div class="skeleton-card">
                        <div class="skeleton-card-image"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-card-header">
                                <div class="skeleton-tag"></div>
                            </div>
                            <div class="skeleton-title"></div>
                            <div class="skeleton-desc short"></div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Section 2 -->
            <div class="skeleton-section">
                <div class="skeleton-section-header"></div>
                <div class="skeleton-grid">
                    <div class="skeleton-card">
                        <div class="skeleton-card-image"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-card-header">
                                <div class="skeleton-tag"></div>
                            </div>
                            <div class="skeleton-title short"></div>
                            <div class="skeleton-desc"></div>
                        </div>
                    </div>
                    <div class="skeleton-card">
                        <div class="skeleton-card-image"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-card-header">
                                <div class="skeleton-tag"></div>
                            </div>
                            <div class="skeleton-title"></div>
                            <div class="skeleton-desc"></div>
                            <div class="skeleton-desc short"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="loading-text">
                正在加载资讯
                <span class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
            </div>
        </div>
    `;
}

/**
 * 显示指定日期的新闻
 */
async function showNews(dateStr) {
    // 切换日期时，重置标签筛选状态，防止之前的筛选影响新内容
    TagFilterManager.clearFilters();

    // 显示骨架屏加载状态
    elements.content.innerHTML = getSkeletonHTML();

    // 更新当前日期显示
    elements.currentDate.textContent = formatDate(dateStr);

    // 更新侧边栏选中状态
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.toggle('active', item.dataset.date === dateStr);
    });

    // 加载并渲染 Markdown
    const markdown = await loadMarkdown(dateStr);
    renderMarkdown(markdown);

    // =========================================
    // Phase 1: 行为设计 - 今日状态标签更新
    // =========================================
    const isToday = dateStr === getTodayStr();
    const todayBadge = document.getElementById('todayBadge');
    if (todayBadge) {
        if (isToday) {
            // 计算新闻数量
            const count = TodayStatusManager.countFromDOM();
            todayBadge.textContent = count > 0 ? `今日 · ${count} 条` : '今日 · 已更新';
        } else {
            todayBadge.textContent = '';
        }
    }

    // =========================================
    // Phase 2: 行为设计 - 返回今日快捷入口
    // =========================================
    const backToTodayBtn = document.getElementById('backToToday');
    if (backToTodayBtn) {
        // 浏览历史日期时显示，浏览今日时隐藏
        backToTodayBtn.classList.toggle('visible', !isToday);
    }

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

    // 显示骨架屏加载状态
    elements.content.innerHTML = getSkeletonHTML();

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
                <p class="empty-desc">等待每日北京时间 08:00 自动生成新闻报告</p>
            </div>
        `;
    }

    elements.status.textContent = '● 在线';
    elements.status.style.color = 'var(--success)';
}

// ============================================================================
//                          标签筛选系统 (Tag Filter System)
// ============================================================================

/**
 * 标签筛选管理器
 * 动态从新闻卡片提取标签，渲染标签云，实现 OR 筛选逻辑
 */
class TagFilterManager {
    static tagCloud = document.getElementById('tagCloud');
    static clearBtn = document.getElementById('tagClearBtn');
    static selectedTags = new Set();

    /**
     * 初始化标签筛选系统
     */
    static init() {
        if (!this.tagCloud || !this.clearBtn) return;

        // 绑定清除按钮
        this.clearBtn.addEventListener('click', () => this.clearFilters());
    }

    /**
     * 从当前页面的新闻卡片中提取所有标签及其出现次数
     */
    static extractTags() {
        const tagCounts = new Map();
        const cards = document.querySelectorAll('.news-card');

        cards.forEach(card => {
            let tags = [];

            // 策略 1: 尝试从隐藏的 div 中获取完整数据 (新方式)
            const tagsDataEl = card.querySelector('.news-tags-data');
            if (tagsDataEl) {
                try {
                    tags = JSON.parse(tagsDataEl.textContent);
                } catch (e) {
                    console.warn('解析隐藏标签数据失败:', e);
                }
            }

            // 策略 2: 回退到 data-tags 属性 (旧方式)
            if (tags.length === 0 && card.dataset.tags) {
                try {
                    tags = JSON.parse(card.dataset.tags);
                } catch (e) {
                    console.warn('解析 data-tags 属性失败:', e);
                }
            }

            // 策略 3: 最后回退到从 DOM 中可见的标签元素提取 (最稳健，但可能不完整)
            if (tags.length === 0) {
                const visibleTags = card.querySelectorAll('.news-tag');
                visibleTags.forEach(tagEl => {
                    tags.push(tagEl.textContent.trim());
                });
            }

            // 策略 4: 如果仍然没有标签，使用来源作为默认标签
            if (tags.length === 0) {
                const sourceTag = card.querySelector('.news-source-tag');
                if (sourceTag) {
                    tags.push(sourceTag.textContent.trim());
                }
            }


            if (tags.length === 0) return;

            // 统计标签
            tags.forEach(tag => {
                if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });

            // 将提取到的标签重新保存到 dataset，方便后续筛选逻辑使用 (applyFilter)
            if (!card.dataset.tags) {
                card.dataset.tags = JSON.stringify(tags);
            }
        });

        // 按出现次数排序
        return [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    }

    /**
     * 渲染标签云
     */
    static render() {
        if (!this.tagCloud) return;

        const tagEntries = this.extractTags();

        if (tagEntries.length === 0) {
            this.tagCloud.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">暂无标签数据</span>';
            return;
        }

        // 计算最大/最小出现次数，用于动态样式
        const maxCount = Math.max(...tagEntries.map(e => e[1]));

        const minCount = Math.min(...tagEntries.map(e => e[1]));

        this.tagCloud.innerHTML = '';

        tagEntries.forEach(([tag, count]) => {
            const item = document.createElement('span');
            item.className = 'tag-item';
            item.dataset.tag = tag;

            // 根据出现频率添加样式类
            if (maxCount > minCount) {
                const ratio = (count - minCount) / (maxCount - minCount);
                if (ratio > 0.7) item.classList.add('very-hot');
                else if (ratio > 0.4) item.classList.add('hot');
            }

            item.innerHTML = `${tag} <span class="tag-count">${count}</span>`;

            // 点击处理
            item.addEventListener('click', () => this.toggleTag(tag, item));

            this.tagCloud.appendChild(item);
        });

        // 恢复之前选中的标签状态
        this.restoreSelection();
    }

    /**
     * 切换标签选中状态
     */
    static toggleTag(tag, itemEl) {
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
            itemEl.classList.remove('active');
        } else {
            this.selectedTags.add(tag);
            itemEl.classList.add('active');
        }

        this.applyFilter();
    }

    /**
     * 恢复之前的选中状态（页面重新渲染后）
     */
    static restoreSelection() {
        if (this.selectedTags.size === 0) return;

        this.tagCloud.querySelectorAll('.tag-item').forEach(item => {
            if (this.selectedTags.has(item.dataset.tag)) {
                item.classList.add('active');
            }
        });

        this.applyFilter();
    }

    /**
     * 应用筛选逻辑（OR 模式）
     */
    static applyFilter() {
        const cards = document.querySelectorAll('.news-card');

        // 无筛选时显示全部
        if (this.selectedTags.size === 0) {
            cards.forEach(card => card.classList.remove('filtered-out'));
            return;
        }

        cards.forEach(card => {
            const tagsAttr = card.dataset.tags;
            if (!tagsAttr) {
                card.classList.add('filtered-out');
                return;
            }

            try {
                const cardTags = JSON.parse(tagsAttr);
                // OR 逻辑：只要有任意一个选中的标签匹配即可
                const hasMatch = cardTags.some(t => this.selectedTags.has(t));
                card.classList.toggle('filtered-out', !hasMatch);
            } catch (e) {
                card.classList.add('filtered-out');
            }
        });
    }

    /**
     * 清除所有筛选
     */
    static clearFilters() {
        this.selectedTags.clear();

        // 移除所有选中状态
        this.tagCloud.querySelectorAll('.tag-item.active').forEach(item => {
            item.classList.remove('active');
        });

        // 显示所有卡片
        document.querySelectorAll('.news-card').forEach(card => {
            card.classList.remove('filtered-out');
        });
    }
}

// ============================================================================
//                          初始化
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // P3: 初始化主题管理器（优先执行，避免闪烁）
    ThemeManager.init();

    // 初始化 ModalManager
    ModalManager.init();

    // 初始化标签筛选系统
    TagFilterManager.init();

    // 绑定刷新按钮
    elements.refreshBtn.addEventListener('click', refresh);

    // 初始化收藏栏
    renderFavoritesSidebar();

    // =========================================
    // Phase 1: 行为设计 - 连续打开天数初始化
    // =========================================
    const streakResult = StreakManager.update();
    const streakDisplay = document.getElementById('streakDisplay');
    const streakText = document.getElementById('streakText');

    if (streakDisplay && streakText) {
        if (streakResult.streakDays > 0) {
            streakText.textContent = StreakManager.getDisplayText();
            streakDisplay.classList.remove('hidden');
        } else {
            streakDisplay.classList.add('hidden');
        }
    }

    // Phase 1: 行为设计 - 新一天首次打开的轻量庆祝提示
    if (streakResult.isNewDay && streakResult.message) {
        showWelcomeToast(streakResult.message);
    }

    // =========================================
    // Phase 2: 行为设计 - 返回今日按钮点击
    // =========================================
    const backToTodayBtn = document.getElementById('backToToday');
    if (backToTodayBtn) {
        backToTodayBtn.addEventListener('click', () => {
            showNews(getTodayStr());
        });
    }

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

/**
 * 显示轻量欢迎/庆祝提示 (Toast)
 * Phase 1: 行为设计 - 暂停时刻 (Pause Moments)
 * @param {string} message - 提示文案
 */
function showWelcomeToast(message) {
    // 检查是否已经有 toast 元素
    let toast = document.getElementById('welcomeToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'welcomeToast';
        toast.className = 'welcome-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;

    // 延迟显示，等待页面加载完成
    setTimeout(() => {
        toast.classList.add('show');

        // 3秒后自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }, 500);
}

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
    static previewPlaceholder = document.getElementById("previewPlaceholder");
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
        this.hidePlaceholder();
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
                }, 3000);
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
        this.contentWrapper.classList.remove('split-mode', 'resizing');
        this.currentUrl = null;
        if (this.previewIframe) this.previewIframe.src = 'about:blank';
        // 重置 CSS 变量
        this.contentWrapper.style.removeProperty('--content-width');

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
        this.hidePlaceholder();
        if (this.previewIframe) {
            this.previewIframe.classList.add("loaded");
        }
        // iframe 加载成功
        console.log('[PreviewManager] Iframe loaded:', this.currentUrl);
    }

    static showLoading() {
        if (this.previewLoading) {
            this.previewLoading.classList.remove('hidden');
            // 点击加载区域可在新标签页打开
            this.previewLoading.onclick = (e) => {
                // 只有点击非骨架屏内容区域时才触发
                if (e.target === this.previewLoading) {
                    this.openInNewTab();
                }
            };
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
        this.hidePlaceholder();
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
        if (this.previewLoading) {
            this.previewLoading.classList.add('hidden');
        }
        this.hidePlaceholder();
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
    n    /*
     * 显示/隐藏占位层
     */
    static showPlaceholder() {
        if (this.previewPlaceholder) this.previewPlaceholder.classList.remove("hidden");
    }

    static hidePlaceholder() {
        if (this.previewPlaceholder) this.previewPlaceholder.classList.add("hidden");
    }

    /**
     * 初始化拖拽分隔线
     * 优化策略：
     * 1. requestAnimationFrame 节流渲染，避免布局抖动
     * 2. setPointerCapture 确保拖拽不中断
     * 3. CSS 变量驱动布局，减少 DOM 操作
     * 4. 拖拽时禁用 CSS 过渡，确保跟手
     */
    static initDraggable() {
        if (!this.splitDivider) return;

        // 从 localStorage 恢复比例
        const savedRatio = localStorage.getItem('preview_split_ratio');
        if (savedRatio) {
            this.splitRatio = parseFloat(savedRatio);
            this.applySplitRatio();
        }

        // RAF 节流相关
        this._rafId = null;
        this._pendingRatio = null;

        const startDrag = (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.splitDivider.classList.add('dragging');
            this.contentWrapper.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            // 指针捕获：确保拖拽期间持续接收事件
            if (e.pointerId !== undefined) {
                this.splitDivider.setPointerCapture(e.pointerId);
            }
        };

        const updateRatio = (clientX) => {
            const wrapperRect = this.contentWrapper.getBoundingClientRect();
            const x = clientX - wrapperRect.left;
            const ratio = Math.max(0.2, Math.min(0.8, x / wrapperRect.width));

            if (this._rafId) return; // 已有待执行的帧，跳过

            this._rafId = requestAnimationFrame(() => {
                this.splitRatio = ratio;
                this.applySplitRatio();
                this._rafId = null;
            });
        };

        const endDrag = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.splitDivider.classList.remove('dragging');
            this.contentWrapper.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // 取消待执行的 RAF，避免状态不一致
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }

            // 保存比例到 localStorage
            localStorage.setItem('preview_split_ratio', this.splitRatio.toString());
        };

        // ========== Pointer Events (推荐，统一鼠标和触摸) ==========
        this.splitDivider.addEventListener('pointerdown', startDrag);

        this.splitDivider.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            updateRatio(e.clientX);
        });

        this.splitDivider.addEventListener('pointerup', endDrag);
        this.splitDivider.addEventListener('pointercancel', endDrag);

        // ========== 降级：Mouse Events (旧浏览器兼容) ==========
        this.splitDivider.addEventListener('mousedown', (e) => {
            if (window.PointerEvent) return; // 有 PointerEvent 就不走这里
            startDrag(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (window.PointerEvent || !this.isDragging) return;
            updateRatio(e.clientX);
        });

        document.addEventListener('mouseup', () => {
            if (window.PointerEvent) return;
            endDrag();
        });

        // ========== 降级：Touch Events (旧浏览器兼容) ==========
        this.splitDivider.addEventListener('touchstart', (e) => {
            if (window.PointerEvent) return;
            startDrag(e);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (window.PointerEvent || !this.isDragging) return;
            updateRatio(e.touches[0].clientX);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (window.PointerEvent) return;
            endDrag();
        });
    }

    /**
     * 应用分屏比例
     * 使用 CSS 变量驱动，配合 will-change 优化渲染性能
     */
    static applySplitRatio() {
        // 使用 CSS 变量，避免频繁操作 DOM 属性
        this.contentWrapper.style.setProperty('--content-width', `${this.splitRatio * 100}%`);
    }
}

// 初始化预览管理器
document.addEventListener('DOMContentLoaded', () => {
    PreviewManager.init();
});

// ============================================================================
//                          搜索功能 (SearchManager)
// ============================================================================

class SearchManager {
    static fuse = null;
    static items = [];

    static init() {
        this.searchInput = document.getElementById('searchInput');
        this.searchClear = document.getElementById('searchClear');
        this.searchCount = document.getElementById('searchCount');

        if (!this.searchInput) return;

        // 绑定事件
        this.searchInput.addEventListener('input', this.debounce((e) => {
            this.search(e.target.value);
        }, 300));

        this.searchClear.addEventListener('click', () => this.clear());

        // 快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== this.searchInput) {
                e.preventDefault();
                this.searchInput.focus();
            }
            if (e.key === 'Escape') {
                this.clear();
            }
        });

        // 初始构建索引
        this.buildIndex();

        // 监听内容变化，重新构建索引
        const observer = new MutationObserver(() => {
            this.buildIndex();
        });

        const content = document.getElementById('content');
        if (content) {
            observer.observe(content, { childList: true, subtree: true });
        }
    }

    static buildIndex() {
        const cards = document.querySelectorAll('.news-card');
        this.items = Array.from(cards).map((card, index) => ({
            id: index,
            title: card.querySelector('.news-title')?.textContent?.trim() || '',
            summary: card.querySelector('.news-summary')?.textContent?.trim() || '',
            source: card.querySelector('.news-source-tag')?.textContent?.trim() || '',
            category: card.closest('.section-header-container, [class*="section"]')?.querySelector('h2')?.textContent?.trim() || '',
            element: card
        }));

        // 配置 Fuse.js
        const options = {
            keys: [
                { name: 'title', weight: 0.5 },
                { name: 'summary', weight: 0.3 },
                { name: 'source', weight: 0.1 },
                { name: 'category', weight: 0.1 }
            ],
            threshold: 0.4,
            includeScore: true,
            includeMatches: true
        };

        this.fuse = new Fuse(this.items, options);
    }

    static search(query) {
        if (!query.trim()) {
            this.showAll();
            this.searchCount.textContent = '';
            return;
        }

        if (!this.fuse) return;

        const results = this.fuse.search(query);

        // 隐藏所有
        this.items.forEach(item => {
            item.element.style.display = 'none';
            this.removeHighlight(item.element);
        });

        // 显示匹配项
        if (results.length === 0) {
            this.showNoResults();
        } else {
            this.hideNoResults();
            results.forEach(result => {
                const item = result.item;
                item.element.style.display = 'flex';
                if (result.matches) {
                    this.highlightMatches(item.element, result.matches);
                }
            });
        }

        // 更新计数
        this.searchCount.textContent = `找到 ${results.length} 个结果`;
    }

    static clear() {
        this.searchInput.value = '';
        this.showAll();
        this.searchCount.textContent = '';
        this.hideNoResults();
        this.searchInput.blur();
    }

    static showAll() {
        this.items.forEach(item => {
            item.element.style.display = 'flex';
            this.removeHighlight(item.element);
        });
        this.hideNoResults();
    }

    static highlightMatches(element, matches) {
        this.removeHighlight(element);

        matches.forEach(match => {
            const key = match.key;
            const indices = match.indices;

            let targetElement;
            if (key === 'title') {
                targetElement = element.querySelector('.news-title');
            } else if (key === 'summary') {
                targetElement = element.querySelector('.news-summary');
            } else if (key === 'source') {
                targetElement = element.querySelector('.news-source-tag');
            }

            if (targetElement && indices.length > 0) {
                const text = targetElement.textContent;
                let html = '';
                let lastIndex = 0;

                indices.forEach(([start, end]) => {
                    html += text.slice(lastIndex, start);
                    html += `<span class="highlight">${text.slice(start, end + 1)}</span>`;
                    lastIndex = end + 1;
                });
                html += text.slice(lastIndex);

                targetElement.innerHTML = html;
            }
        });
    }

    static removeHighlight(element) {
        const highlights = element.querySelectorAll('.highlight');
        highlights.forEach(h => {
            const parent = h.parentNode;
            parent.replaceChild(document.createTextNode(h.textContent), h);
            parent.normalize();
        });
    }

    static showNoResults() {
        let noResults = document.getElementById('noSearchResults');
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.id = 'noSearchResults';
            noResults.className = 'no-search-results';
            noResults.innerHTML = `
                <div class="no-search-results-icon">🔍</div>
                <h3>未找到相关文章</h3>
                <p>尝试使用其他关键词搜索</p>
            `;
            const content = document.getElementById('content');
            if (content) content.appendChild(noResults);
        }
        noResults.style.display = 'block';
    }

    static hideNoResults() {
        const noResults = document.getElementById('noSearchResults');
        if (noResults) noResults.style.display = 'none';
    }

    static debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
}

// 初始化搜索功能和标签筛选
document.addEventListener('DOMContentLoaded', () => {
    SearchManager.init();
    TagFilterManager.init();
});
