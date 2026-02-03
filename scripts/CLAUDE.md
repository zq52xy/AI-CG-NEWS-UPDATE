# scripts/
> L2 | 父级: ../CLAUDE.md

## 成员清单

- **fetch_news.py** - 核心执行脚本，从 arXiv/GitHub/HF 等源抓取并生成日报。依赖 httpx, bs4。
  - `sanitize_html_text()`: 关键清洗函数，移除所有 HTML 标签（含未闭合），防止布局被破坏
  - 所有 NewsItem 的 summary 必须经 `sanitize_html_text()` 处理
- **daily_fetch.bat** - Windows 批处理，用于定时执行 fetch_news.py
- **requirements.txt** - Python 依赖

[PROTOCOL]: 变更时更新此头部，然后检查 ../CLAUDE.md
