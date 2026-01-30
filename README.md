# AI & CG 每日资讯

自动聚合 AI 和计算机图形学领域的最新资讯。

[![Website](https://img.shields.io/badge/Website-Live-blue)](https://ai-cg-news-update.pages.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Update](https://img.shields.io/badge/Update-Daily-orange)](https://ai-cg-news-update.pages.dev/)

## 🌐 在线访问

**访问地址**：https://ai-cg-news-update.pages.dev/

无需安装，直接访问即可查看最新的 AI & CG 领域资讯。

## ✨ 核心特性

1. **📑 分屏预览系统** - 点击链接右侧 iframe 实时预览，支持拖拽调整比例（20%-80%），自动保存偏好设置
2. **⭐ 智能收藏管理** - 收藏感兴趣的文章，支持编辑标题/添加备注，侧边栏快速访问
3. **📡 多源聚合** - 自动抓取 arXiv、GitHub Trending、Hugging Face、skills.sh、Hacker News、Reddit、官方博客等 10+ 来源
4. **📅 历史记录** - 自动保留最近7天新闻，支持按日期快速切换
5. **🎨 学术风格 UI** - Noto Serif SC 标题字体，深靛蓝配色方案，6px 自定义滚动条
6. **📱 响应式设计** - 桌面端分屏、移动端底部 Sheet，完美适配各种设备
7. **📄 ArXiv 特殊处理** - 检测论文链接，提供 PDF/摘要快速跳转

## 📰 数据来源

| 来源 | 类型 | 说明 |
|------|------|------|
| arXiv | 学术论文 | cs.AI, cs.CV, cs.GR, cs.LG 等方向 |
| GitHub Trending | 开源项目 | 每日热门仓库 |
| Hugging Face | AI 模型/数据集 | 热门模型、数据集和 Spaces 项目 |
| skills.sh | 技能趋势 | 技术技能趋势和流行度分析 |
| Hacker News | 技术社区 | 前沿技术讨论 |
| Reddit | 社区讨论 | r/UE5, r/Blender, r/Threejs 等 |
| 官方博客 | 引擎动态 | Unreal, Unity, Blender, Godot, NVIDIA |

## ⏰ 更新频率

每天北京时间 **20:00** 自动更新。

## 🛠️ 技术栈

### 前端
- **纯原生技术**：HTML5 + CSS3 + Vanilla JavaScript
- **Markdown 渲染**：marked.js
- **字体**：Noto Sans SC + Noto Serif SC（Google Fonts）
- **存储**：localStorage（收藏、偏好设置）

### 后端/数据
- **静态托管**：Cloudflare Pages
- **数据源**：Python 抓取脚本（见 `scripts/` 目录）
- **格式**：Markdown 文件每日生成

### 自动化
- **定时任务**：GitHub Actions / 本地 cron
- **抓取脚本**：Python + requests + BeautifulSoup
- **部署**：自动推送到 Pages

## 📁 项目结构

```
AI-CG-NEWS-UPDATE/
├── website/           # 前端网站
│   ├── index.html     # 入口页面
│   ├── style.css      # 样式表（响应式 + 分屏布局）
│   ├── app.js         # 核心逻辑（PreviewManager + FavoritesManager）
│   └── src/           # 源码目录
├── scripts/           # 数据抓取脚本
│   ├── fetch_news.py  # 主抓取脚本
│   └── requirements.txt
├── daily_news/        # 生成的 Markdown 报告
│   ├── 2026-01-30.md
│   └── ...
└── img/               # 版块 banner 图片
```

## 🚀 快速开始

### 方式一：在线访问（推荐）
直接访问 https://ai-cg-news-update.pages.dev/

### 方式二：本地运行
```bash
# 1. 克隆仓库
git clone https://github.com/zq52xy/AI-CG-NEWS-UPDATE.git
cd AI-CG-NEWS-UPDATE

# 2. 启动本地服务器
cd website
python -m http.server 8080

# 3. 浏览器打开 http://localhost:8080
```

### 方式三：运行数据抓取（可选）
```bash
# 安装依赖
pip install -r scripts/requirements.txt

# 运行抓取
cd scripts
python fetch_news.py --all --with-summary
```

## 🖼️ 功能展示

> 📷 **截图预留位置** - 建议添加以下截图：
> 1. 桌面端分屏预览界面
> 2. 收藏管理功能
> 3. 移动端响应式效果
> 4. 历史记录切换

## 🎯 使用场景

- **科研人员** - 追踪 AI/CG 领域最新论文（arXiv 聚合）
- **开发者** - 发现热门开源项目（GitHub Trending）
- **技术管理者** - 了解行业动态（多源综合）
- **学习者** - 系统性学习资源（分类清晰）

## ⚙️ 配置说明

### 前端配置（`website/app.js`）
```javascript
const CONFIG = {
    newsDir: '../daily_news/',    // 新闻文件目录
    historyLimit: 7,              // 历史记录数量
    autoRefresh: 0                // 自动刷新间隔（毫秒）
};
```

### 抓取配置（`scripts/fetch_news.py`）
支持配置抓取来源、生成摘要、自定义输出格式等。

## 📝 开发计划

- [x] 基础新闻展示
- [x] 分屏预览系统
- [x] 收藏管理功能
- [x] 响应式设计
- [x] ArXiv 特殊处理
- [ ] 搜索功能
- [ ] 标签分类
- [ ] 深色模式
- [ ] 英文版界面

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 🐛 常见问题

**Q: 为什么有些网站无法预览？**  
A: 部分网站（GitHub、Twitter 等）设置了 X-Frame-Options 阻止嵌入，这是安全限制。可点击"在新标签页打开"。

**Q: 收藏数据存储在哪里？**  
A: 使用浏览器 localStorage 本地存储，不会上传到服务器。

**Q: 如何添加新的数据源？**  
A: 修改 `scripts/fetch_news.py`，添加新的抓取逻辑。

**Q: 分屏比例调整后不保存？**  
A: 检查浏览器是否开启了"阻止第三方 Cookie"，localStorage 需要存储权限。

**Q: 移动端预览面板如何关闭？**  
A: 点击工具栏的 ✕ 按钮，或向下滑动关闭。

## 📜 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**
