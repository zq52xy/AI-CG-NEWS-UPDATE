@echo off
REM ============================================================================
REM  AI & CG 新闻聚合 - 每日自动抓取脚本
REM
REM  [INPUT]: 依赖 python 环境 和 fetch_news.py
REM  [OUTPUT]: 每日此时触发新闻抓取任务
REM  [POS]: scripts/ 目录下的任务调度入口，被 Windows Task Scheduler "\AI_CG_News_Daily" 调用
REM  [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
REM
REM  调度时间: 每天 08:00 (北京时间)
REM ============================================================================

cd /d "C:\Users\ZhouQuan\Desktop\AI-CG-NEWS-UPDATE\scripts"

echo [%date% %time%] 开始抓取新闻...
python fetch_news.py --all --with-summary

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] 抓取完成!
) else (
    echo [%date% %time%] 抓取失败，错误代码: %ERRORLEVEL%
)

exit /b %ERRORLEVEL%
