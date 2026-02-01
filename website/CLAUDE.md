# Website/
> L2 | 父级: ../CLAUDE.md

## 成员清单

- `app.js`: 核心逻辑，包含新闻加载、搜索、收藏管理、分屏预览系统
  - `StreakManager`: Phase 1 行为设计 - 连续打开天数追踪（localStorage 持久化）
  - `TodayStatusManager`: Phase 1 行为设计 - 今日状态管理与新闻计数
  - `PreviewManager`: 分屏预览，拖拽栏使用 RAF 节流 + CSS 变量 + PointerEvents 优化
  - `SearchManager`: Fuse.js 模糊搜索，支持高亮和快捷键
  - `FavoritesManager`: localStorage 收藏持久化
  - `ModalManager`: 模态框管理（编辑/删除收藏）
  - `getSkeletonHTML()`: 流光骨架屏 Loading 动画生成
  - `showWelcomeToast()`: Phase 1 行为设计 - 轻量庆祝提示 (Pause Moments)
- `index.html`: 入口文件，定义页面结构和基本元数据，包含主内容区骨架屏和预览面板骨架屏 Loading 结构
- `style.css`: 样式表，分屏布局使用 CSS 变量 `--content-width` 驱动，包含流光骨架屏动画，Section Banner 样式增强遮罩遮盖背景文字

## 子目录

- `src/hooks/`: React Hooks
- `src/network/`: HTTP 网络层（基于 ky）

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
