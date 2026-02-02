# scripts/
> L2 | 父级: ../CLAUDE.md

成员清单
fetch_news.py: 核心执行脚本，负责从 arXiv/GitHub/HF 等源抓取数据并生成日报。依赖 httpx, bs4。
  - `sanitize_html_text()`: 关键清洗函数，移除所有 HTML 标签（包括未闭合的），防止布局被破坏
  - 所有 NewsItem 的 summary 字段必须经过 `sanitize_html_text()` 处理
daily_fetch.bat: Windows 批处理脚本，用于定时任务执行 fetch_news.py。
requirements.txt: Python 依赖列表。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
