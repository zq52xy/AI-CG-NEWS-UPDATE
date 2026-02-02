# scripts/
> L2 | 父级: ../CLAUDE.md

成员清单
fetch_news.py: 核心执行脚本，负责从 arXiv/GitHub/HF 等源抓取数据并生成日报。依赖 httpx, bs4。对摘要做 HTML 清洗，避免卡片布局嵌套与破坏。
daily_fetch.bat: Windows 批处理脚本，用于定时任务执行 fetch_news.py。
requirements.txt: Python 依赖列表。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
