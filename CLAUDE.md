---
description: 
alwaysApply: true
---

---
description: AI-CG-NEWS 项目上下文
alwaysApply: true
---

# AI-CG-NEWS - 每日 AI & CG 资讯聚合

Python 抓取 + HTML/JS 前端。

## 目录

- **scripts/** - 核心抓取脚本（fetch_news.py、daily_fetch.bat）
- **website/** - 前端展示（app.js、index.html、style.css）
- **api/** - Vercel Serverless（api/reader 供分屏读者模式拉取 HTML）
- **daily_news/** - 每日生成的 Markdown 日报
- **docs/** - 计划与设计系统文档
- **.cursor/rules/** - Cursor 规则（设计流程见 design.mdc）

## 配置

- `.gitignore` - Git 忽略
- `README.md` - 项目说明
- `_design_system.html` - 设计系统基准（若有）

## UI / 前端设计

当涉及界面或前端设计时，遵循 **.cursor/rules/design.mdc** 中的规则与流程（布局 → 主题 → 动效 → 输出到 .superdesign/design_iterations）。
