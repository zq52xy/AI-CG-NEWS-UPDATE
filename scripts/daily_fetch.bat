@echo off
REM ============================================================================
REM  AI & CG 新闻聚合 - 每日自动抓取脚本
REM  调度时间: 每天 20:00
REM  [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
REM ============================================================================

cd /d "C:\Users\ZhouQuan\.gemini\antigravity\skills\ai-cg-news-aggregator\scripts"

echo [%date% %time%] 开始抓取新闻...
python fetch_news.py --all --with-summary

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] 抓取完成!
) else (
    echo [%date% %time%] 抓取失败，错误代码: %ERRORLEVEL%
)

exit /b %ERRORLEVEL%
