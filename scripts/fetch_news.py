#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[INPUT]: 依赖 httpx, feedparser, beautifulsoup4 进行网络请求
[OUTPUT]: 对外提供 CLI 接口，生成 Markdown 格式的新闻报告
[POS]: ai-cg-news-aggregator Skill 的核心执行脚本
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""

# ============================================================================
#                      AI & CG 新闻聚合脚本
# ============================================================================

import argparse
import datetime
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

# ============================================================================
#                           数据结构定义
# ============================================================================

@dataclass
class NewsItem:
    """单条新闻数据"""
    title: str
    url: str
    source: str
    category: str
    score: int = 0
    comments: int = 0
    authors: str = ""
    summary: str = ""
    date: str = ""
    extra: dict = field(default_factory=dict)


# ============================================================================
#                           arXiv 抓取模块
# ============================================================================

def fetch_arxiv(categories: list[str], days: int = 1, max_results: int = 30) -> list[NewsItem]:
    """
    从 arXiv 获取最新论文（使用 Atom API，比 RSS 更稳定）
    
    Args:
        categories: arXiv 分类列表，如 ['cs.AI', 'cs.GR', 'cs.CV']
        days: 获取最近几天的论文
        max_results: 最大结果数
    
    Returns:
        新闻条目列表
    """
    try:
        import feedparser
    except ImportError:
        print("[ERROR] 请安装 feedparser: pip install feedparser")
        return []
    
    items = []
    
    # 关键词过滤（CG 和 AI 核心话题）
    keywords = [
        'neural rendering', 'diffusion', 'transformer', 'ray tracing',
        'real-time', 'GPU', '3D', 'generative', 'NeRF', 'Gaussian',
        'language model', 'vision', 'multimodal', 'embodied'
    ]
    
    per_cat_limit = max(10, max_results // len(categories))
    
    for cat in categories:
        # 使用 Atom API（比 RSS 更稳定）
        url = f"https://export.arxiv.org/api/query?search_query=cat:{cat}&start=0&max_results={per_cat_limit}&sortBy=submittedDate&sortOrder=descending"
        print(f"[INFO] 正在获取 arXiv {cat}...")
        
        try:
            feed = feedparser.parse(url)
            
            if not feed.entries:
                # 降级到 RSS
                rss_url = f"https://export.arxiv.org/rss/{cat}"
                print(f"[INFO] Atom API 无结果，尝试 RSS: {cat}")
                feed = feedparser.parse(rss_url)
            
            for entry in feed.entries[:per_cat_limit]:
                # 提取标题（去除分类前缀）
                title = re.sub(r'^\([^)]+\)\s*', '', entry.title)
                title = title.strip()
                
                # 提取作者
                authors = entry.get('author', entry.get('authors', 'Unknown'))
                if isinstance(authors, list):
                    authors = ', '.join([a.get('name', str(a)) for a in authors[:3]])
                
                # 提取摘要（截取前 200 字符）
                summary = entry.get('summary', '')[:200] + '...'
                
                # 提取链接
                link = entry.get('link', '')
                if isinstance(entry.get('links'), list) and entry.links:
                    for l in entry.links:
                        if l.get('type') == 'application/pdf':
                            link = l.get('href', link)
                            break
                
                # 关键词匹配评分
                score = sum(1 for kw in keywords if kw.lower() in title.lower() or kw.lower() in summary.lower())
                
                items.append(NewsItem(
                    title=title,
                    url=link,
                    source='arXiv',
                    category=cat,
                    authors=authors if isinstance(authors, str) else str(authors),
                    summary=summary,
                    score=score,
                    date=entry.get('published', '')
                ))
                
        except Exception as e:
            print(f"[WARN] 获取 {cat} 失败: {e}")
    
    # 按相关性评分排序
    items.sort(key=lambda x: x.score, reverse=True)
    return items[:max_results]


# ============================================================================
#                        GitHub Trending 抓取模块
# ============================================================================

def fetch_github(topics: list[str], language: str = "", since: str = "daily") -> list[NewsItem]:
    """
    从 GitHub Trending 获取热门项目
    
    Args:
        topics: 话题标签列表
        language: 编程语言筛选
        since: 时间范围 (daily/weekly/monthly)
    
    Returns:
        新闻条目列表
    """
    try:
        import httpx
        from bs4 import BeautifulSoup
    except ImportError:
        print("[ERROR] 请安装依赖: pip install httpx beautifulsoup4")
        return []
    
    items = []
    url = f"https://github.com/trending/{language}?since={since}"
    
    print(f"[INFO] 正在获取 GitHub Trending ({language or 'all'})...")
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = httpx.get(url, headers=headers, timeout=30)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 解析 Trending 列表
        for article in soup.select('article.Box-row')[:20]:
            
            # 项目名称和链接
            h2 = article.select_one('h2 a')
            if not h2:
                continue
            
            repo_path = h2.get('href', '').strip('/')
            repo_url = f"https://github.com/{repo_path}"
            repo_name = repo_path.split('/')[-1] if '/' in repo_path else repo_path
            
            # 描述
            desc_elem = article.select_one('p')
            description = desc_elem.get_text(strip=True) if desc_elem else ''
            
            # 语言
            lang_elem = article.select_one('[itemprop="programmingLanguage"]')
            lang = lang_elem.get_text(strip=True) if lang_elem else 'Unknown'
            
            # 今日 Star 增量
            star_elem = article.select_one('.float-sm-right')
            today_stars = 0
            if star_elem:
                star_text = star_elem.get_text(strip=True)
                match = re.search(r'([\d,]+)', star_text)
                if match:
                    today_stars = int(match.group(1).replace(',', ''))
            
            # 关键词匹配
            keywords = ['graphics', 'rendering', 'ai', 'ml', 'neural', '3d', 'gpu', 'cuda']
            score = sum(1 for kw in keywords if kw in description.lower() or kw in repo_name.lower())
            
            items.append(NewsItem(
                title=repo_name,
                url=repo_url,
                source='GitHub',
                category=lang,
                summary=description[:150],
                score=today_stars + score * 10,
                extra={'today_stars': today_stars, 'language': lang}
            ))
            
    except Exception as e:
        print(f"[WARN] 获取 GitHub Trending 失败: {e}")
    
    items.sort(key=lambda x: x.score, reverse=True)
    return items


# ============================================================================
#                        Hacker News 抓取模块
# ============================================================================

def fetch_hackernews(keywords: list[str], min_score: int = 50) -> list[NewsItem]:
    """
    从 Hacker News 获取相关热帖
    
    Args:
        keywords: 筛选关键词
        min_score: 最低分数阈值
    
    Returns:
        新闻条目列表
    """
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []
    
    items = []
    
    print("[INFO] 正在获取 Hacker News 热帖...")
    
    try:
        # 获取 Top Stories
        top_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
        response = httpx.get(top_url, timeout=30)
        story_ids = response.json()[:100]  # 取前 100
        
        for story_id in story_ids:
            item_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
            item_resp = httpx.get(item_url, timeout=10)
            story = item_resp.json()
            
            if not story or story.get('type') != 'story':
                continue
            
            title = story.get('title', '')
            score = story.get('score', 0)
            comments = story.get('descendants', 0)
            
            # 分数过滤
            if score < min_score:
                continue
            
            # 关键词匹配
            title_lower = title.lower()
            matched = any(kw.lower() in title_lower for kw in keywords)
            
            if not matched:
                continue
            
            items.append(NewsItem(
                title=title,
                url=story.get('url', f"https://news.ycombinator.com/item?id={story_id}"),
                source='HackerNews',
                category='Discussion',
                score=score,
                comments=comments,
                extra={'hn_id': story_id}
            ))
            
            # 限制请求频率
            if len(items) >= 15:
                break
                
    except Exception as e:
        print(f"[WARN] 获取 Hacker News 失败: {e}")
    
    return items


# ============================================================================
#                         Reddit 抓取模块
# ============================================================================

def fetch_reddit(
    subreddits: list[str] = None,
    min_upvotes: int = 50,
    limit: int = 15
) -> list[NewsItem]:
    """
    从 Reddit 获取热门帖子
    
    Args:
        subreddits: 目标 Subreddit 列表
        min_upvotes: 最低 upvotes 阈值
        limit: 每个 subreddit 获取数量
    
    Returns:
        新闻条目列表
    """
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []
    
    if subreddits is None:
        subreddits = [
            'MachineLearning',
            'GraphicsProgramming',
            'computergraphics',
            'LocalLLaMA',
            'artificial',
            'unrealengine',       # Unreal Engine 社区
            'unrealengine5',      # UE5 专属
            'gamedev'             # 游戏开发
        ]
    
    items = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-CG-NewsBot/1.0'
    }
    
    for sub in subreddits:
        print(f"[INFO] 正在获取 r/{sub}...")
        url = f"https://www.reddit.com/r/{sub}/hot.json?limit={limit}"
        
        try:
            response = httpx.get(url, headers=headers, timeout=30)
            data = response.json()
            
            posts = data.get('data', {}).get('children', [])
            
            for post in posts:
                post_data = post.get('data', {})
                
                # 跳过置顶和广告
                if post_data.get('stickied') or post_data.get('is_self') is None:
                    continue
                
                title = post_data.get('title', '')
                score = post_data.get('ups', 0)
                comments = post_data.get('num_comments', 0)
                permalink = post_data.get('permalink', '')
                
                # 过滤低热度
                if score < min_upvotes:
                    continue
                
                items.append(NewsItem(
                    title=title,
                    url=f"https://www.reddit.com{permalink}",
                    source='Reddit',
                    category=f"r/{sub}",
                    score=score,
                    comments=comments,
                    extra={
                        'subreddit': sub
                    }
                ))
                
        except Exception as e:
            print(f"[WARN] 获取 r/{sub} 失败: {e}")
    
    # 智能排序：确保每个社区至少有 1 条，UE 社区优先保证 2 条
    # 1. 按社区分组
    by_subreddit = {}
    for item in items:
        sub = item.extra.get('subreddit', '')
        if sub not in by_subreddit:
            by_subreddit[sub] = []
        by_subreddit[sub].append(item)
    
    # 2. 每个社区按热度排序
    for sub in by_subreddit:
        by_subreddit[sub].sort(key=lambda x: x.score, reverse=True)
    
    # 3. 优先选取：UE 社区各取 2 条，其他社区各取 1 条
    priority_subs = ['unrealengine', 'unrealengine5', 'gamedev']  # 优先社区
    result = []
    
    # 优先社区各取 2 条
    for sub in priority_subs:
        if sub in by_subreddit:
            result.extend(by_subreddit[sub][:2])
            by_subreddit[sub] = by_subreddit[sub][2:]
    
    # 其他社区各取 1 条
    for sub, sub_items in by_subreddit.items():
        if sub not in priority_subs and sub_items:
            result.append(sub_items[0])
            by_subreddit[sub] = sub_items[1:]
    
    # 4. 剩余位置按热度填充
    remaining = []
    for sub_items in by_subreddit.values():
        remaining.extend(sub_items)
    remaining.sort(key=lambda x: x.score, reverse=True)
    
    # 填充到 20 条
    slots_left = 20 - len(result)
    result.extend(remaining[:slots_left])
    
    # 最终按热度排序展示
    result.sort(key=lambda x: x.score, reverse=True)
    return result[:20]


# ============================================================================
#                     CG 图形学专属抓取模块
# ============================================================================

def fetch_cg_graphics(
    min_upvotes: int = 10,
    limit: int = 15
) -> list[NewsItem]:
    """
    从多个 CG 图形学相关社区获取热门内容
    
    覆盖领域:
        - Unreal Engine (r/unrealengine, r/unrealengine5)
        - Three.js (r/threejs)
        - Blender (r/blender, r/blenderhelp)
        - Cinema 4D (r/Cinema4D)
        - Houdini (r/Houdini)
        - ShaderToy / Shaders (r/shaders, r/opengl)
        - 通用 CG (r/computergraphics, r/GraphicsProgramming)
    
    Args:
        min_upvotes: 最低 upvotes 阈值
        limit: 每个社区获取数量
    
    Returns:
        新闻条目列表，AI 相关内容优先
    """
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []
    
    # CG 图形学专属社区列表
    cg_subreddits = [
        # Unreal Engine 生态
        ('unrealengine', 'Unreal Engine'),
        ('unrealengine5', 'UE5'),
        # Three.js / WebGL
        ('threejs', 'Three.js'),
        # Blender 生态
        ('blender', 'Blender'),
        ('blenderhelp', 'Blender Help'),
        # Cinema 4D
        ('Cinema4D', 'Cinema 4D'),
        # Houdini
        ('Houdini', 'Houdini'),
        # Shaders / ShaderToy
        ('shaders', 'Shaders'),
        ('opengl', 'OpenGL'),
        # 通用 CG
        ('computergraphics', 'CG'),
        ('GraphicsProgramming', 'Graphics'),
    ]
    
    # AI 相关关键词（用于优先排序）
    ai_keywords = [
        'ai', 'machine learning', 'ml', 'neural', 'deep learning',
        'gpt', 'llm', 'diffusion', 'stable diffusion', 'midjourney',
        'generative', 'procedural', 'automated', 'artificial intelligence',
        'comfyui', 'automatic', 'dall-e', 'dalle', 'sora', 'kling',
        'nerf', 'gaussian', 'splat', '3d gaussian', 'radiance field'
    ]
    
    items = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CG-Graphics-Bot/1.0'
    }
    
    for sub, label in cg_subreddits:
        print(f"[INFO] 正在获取 r/{sub} ({label})...")
        url = f"https://www.reddit.com/r/{sub}/hot.json?limit={limit}"
        
        try:
            response = httpx.get(url, headers=headers, timeout=30)
            data = response.json()
            
            posts = data.get('data', {}).get('children', [])
            
            for post in posts:
                post_data = post.get('data', {})
                
                # 跳过置顶和广告
                if post_data.get('stickied'):
                    continue
                
                title = post_data.get('title', '')
                score = post_data.get('ups', 0)
                comments = post_data.get('num_comments', 0)
                permalink = post_data.get('permalink', '')
                selftext = post_data.get('selftext', '')[:200]  # 取前200字符
                
                # 过滤低热度
                if score < min_upvotes:
                    continue
                
                # 检测是否 AI 相关
                text_lower = (title + ' ' + selftext).lower()
                is_ai_related = any(kw in text_lower for kw in ai_keywords)
                
                items.append(NewsItem(
                    title=title,
                    url=f"https://www.reddit.com{permalink}",
                    source='Reddit-CG',
                    category=label,
                    score=score,
                    comments=comments,
                    summary=selftext,
                    extra={
                        'subreddit': sub,
                        'label': label,
                        'is_ai_related': is_ai_related
                    }
                ))
                
        except Exception as e:
            print(f"[WARN] 获取 r/{sub} 失败: {e}")
    
    # 智能排序：AI 相关优先，然后按热度
    # 分离 AI 相关和普通内容
    ai_items = [item for item in items if item.extra.get('is_ai_related')]
    normal_items = [item for item in items if not item.extra.get('is_ai_related')]
    
    # 各自按热度排序
    ai_items.sort(key=lambda x: x.score, reverse=True)
    normal_items.sort(key=lambda x: x.score, reverse=True)
    
    # AI 相关优先，然后普通内容
    result = ai_items + normal_items
    
    # 确保每个领域至少有 1 条（多样性保证）
    seen_labels = set()
    diverse_result = []
    remaining = []
    
    for item in result:
        label = item.extra.get('label')
        if label not in seen_labels:
            diverse_result.append(item)
            seen_labels.add(label)
        else:
            remaining.append(item)
    
    # 填充剩余位置
    diverse_result.extend(remaining)
    
    # 合并官方源（更权威）
    official_items = fetch_cg_official()
    
    # 官方源放在前面（优先展示），然后是社区内容
    # 但仍保持 AI 相关优先
    all_items = official_items + diverse_result
    
    # 重新按 AI 相关性和分数排序
    ai_items = [item for item in all_items if item.extra.get('is_ai_related')]
    normal_items = [item for item in all_items if not item.extra.get('is_ai_related')]
    
    # 官方源标记 🏛️，社区源保持原样
    final_result = ai_items + normal_items
    
    return final_result[:30]  # CG 版块返回更多条目（含官方源）


# ============================================================================
#                     CG 官方源抓取模块
# ============================================================================

def fetch_cg_official() -> list[NewsItem]:
    """
    从 CG 软件官方博客/RSS 获取最新资讯
    
    官方源（更权威、更即时）:
        - Unreal Engine 官方博客
        - Blender 官方博客
        - Three.js GitHub Releases
        - Houdini (SideFX) 官方博客
        - Maxon (Cinema 4D) 官方博客
        - Unity 官方博客
    
    Returns:
        新闻条目列表
    """
    import feedparser
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []
    
    # 官方 RSS 源列表
    official_feeds = [
        # Unreal Engine
        {
            'name': 'Unreal Engine',
            'url': 'https://www.unrealengine.com/en-US/rss',
            'label': 'UE Official',
            'type': 'rss'
        },
        # Blender
        {
            'name': 'Blender',
            'url': 'https://www.blender.org/feed/',
            'label': 'Blender Official',
            'type': 'rss'
        },
        # Three.js GitHub Releases
        {
            'name': 'Three.js',
            'url': 'https://github.com/mrdoob/three.js/releases.atom',
            'label': 'Three.js Releases',
            'type': 'atom'
        },
        # SideFX Houdini
        {
            'name': 'Houdini',
            'url': 'https://www.sidefx.com/feed/',
            'label': 'Houdini Official',
            'type': 'rss'
        },
        # Unity
        {
            'name': 'Unity',
            'url': 'https://blog.unity.com/feed',
            'label': 'Unity Official',
            'type': 'rss'
        },
        # Godot Engine
        {
            'name': 'Godot',
            'url': 'https://godotengine.org/rss.xml',
            'label': 'Godot Official',
            'type': 'rss'
        },
        # NVIDIA Developer (Graphics)
        {
            'name': 'NVIDIA',
            'url': 'https://developer.nvidia.com/blog/feed/',
            'label': 'NVIDIA Dev',
            'type': 'rss'
        },
    ]
    
    # AI 相关关键词
    ai_keywords = [
        'ai', 'machine learning', 'neural', 'deep learning',
        'diffusion', 'generative', 'gaussian', 'nerf', 'dlss',
        'ray tracing', 'rtx', 'tensor'
    ]
    
    items = []
    
    for feed_info in official_feeds:
        name = feed_info['name']
        url = feed_info['url']
        label = feed_info['label']
        
        print(f"[INFO] 正在获取 {name} 官方源...")
        
        try:
            feed = feedparser.parse(url)
            
            if not feed.entries:
                print(f"[WARN] {name} 无法获取或无内容")
                continue
            
            for entry in feed.entries[:5]:  # 每个源取前5条
                title = entry.get('title', '')
                link = entry.get('link', '')
                summary = entry.get('summary', entry.get('description', ''))[:200]
                published = entry.get('published', entry.get('updated', ''))
                
                # 清理 HTML 标签
                title = re.sub(r'<[^>]+>', '', title).strip()
                summary = re.sub(r'<[^>]+>', '', summary).strip()
                
                # 检测是否 AI 相关
                text_lower = (title + ' ' + summary).lower()
                is_ai_related = any(kw in text_lower for kw in ai_keywords)
                
                items.append(NewsItem(
                    title=title,
                    url=link,
                    source='Official',
                    category=label,
                    score=100 if is_ai_related else 50,  # AI 相关给高分
                    summary=summary,
                    date=published,
                    extra={
                        'software': name,
                        'label': label,
                        'is_ai_related': is_ai_related,
                        'is_official': True
                    }
                ))
                
        except Exception as e:
            print(f"[WARN] 获取 {name} 官方源失败: {e}")
    
    # AI 相关优先，然后按日期/分数排序
    ai_items = [item for item in items if item.extra.get('is_ai_related')]
    normal_items = [item for item in items if not item.extra.get('is_ai_related')]
    
    ai_items.sort(key=lambda x: x.score, reverse=True)
    normal_items.sort(key=lambda x: x.score, reverse=True)
    
    result = ai_items + normal_items
    
    # 确保每个软件至少有 1 条
    seen_software = set()
    diverse_result = []
    remaining = []
    
    for item in result:
        software = item.extra.get('software')
        if software not in seen_software:
            diverse_result.append(item)
            seen_software.add(software)
        else:
            remaining.append(item)
    
    diverse_result.extend(remaining)
    
    return diverse_result[:15]


# ============================================================================
#                        Twitter/X 抓取模块 (via Nitter)
# ============================================================================

def fetch_bluesky(
    accounts: list[str] = None,
    keywords: list[str] = None,
    limit: int = 15
) -> list[NewsItem]:
    """
    从 Bluesky 获取 KOL 动态（使用 AT Protocol 公开 API）
    
    Args:
        accounts: Bluesky 账号列表（格式：handle.bsky.social）
        keywords: AI/CG/UE 关键词过滤
        limit: 最大获取数量
    
    Returns:
        新闻条目列表
    """
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []
    
    if accounts is None:
        # AI/CG/UE 领域活跃账号
        accounts = [
            'jay.bsky.team',           # Bluesky 官方
            'simonwillison.net',       # AI 开发者
            'stratechery.com',         # 科技分析
            'arstechnica.com',         # 科技新闻
        ]
    
    if keywords is None:
        keywords = [
            'ai', 'gpt', 'llm', 'diffusion', 'neural', 'rendering',
            '3d', 'graphics', 'cuda', 'gpu', 'transformer', 'model',
            'paper', 'research', 'release', 'open source',
            'unreal', 'ue5', 'game dev', 'nanite', 'lumen'  # UE 相关
        ]
    
    items = []
    headers = {
        'User-Agent': 'AI-CG-NewsBot/1.0'
    }
    
    for account in accounts:
        print(f"[INFO] 正在获取 @{account} 的 Bluesky 帖子...")
        
        # 解析 DID
        try:
            resolve_url = f"https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={account}"
            resolve_resp = httpx.get(resolve_url, headers=headers, timeout=10)
            
            if resolve_resp.status_code != 200:
                print(f"[WARN] 无法解析 @{account}")
                continue
            
            did = resolve_resp.json().get('did', '')
            if not did:
                continue
            
            # 获取帖子
            feed_url = f"https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor={did}&limit=20"
            feed_resp = httpx.get(feed_url, headers=headers, timeout=15)
            
            if feed_resp.status_code != 200:
                print(f"[WARN] 无法获取 @{account} 的帖子")
                continue
            
            feed_data = feed_resp.json()
            posts = feed_data.get('feed', [])
            
            for post_item in posts[:10]:
                post = post_item.get('post', {})
                record = post.get('record', {})
                
                text = record.get('text', '')[:200]
                created_at = record.get('createdAt', '')
                uri = post.get('uri', '')
                
                # 构建 Bluesky 网页链接
                author = post.get('author', {})
                handle = author.get('handle', '')
                rkey = uri.split('/')[-1] if uri else ''
                web_url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else ''
                
                # 关键词匹配
                text_lower = text.lower()
                matched = any(kw.lower() in text_lower for kw in keywords)
                
                if matched and text:
                    items.append(NewsItem(
                        title=text,
                        url=web_url,
                        source='Bluesky',
                        category=f"@{account}",
                        date=created_at,
                        extra={
                            'account': account,
                            'handle': handle
                        }
                    ))
                    
        except Exception as e:
            print(f"[WARN] 获取 @{account} 失败: {e}")
    
    return items[:limit]


# 保留 fetch_twitter 作为别名（向后兼容）
def fetch_twitter(*args, **kwargs):
    """已弃用：Twitter API 不再可用，请使用 fetch_bluesky"""
    print("[WARN] Twitter 数据源已弃用（API 关闭），自动切换到 Bluesky")
    return fetch_bluesky(*args, **kwargs)


# ============================================================================
#                         中文概述生成模块
# ============================================================================

def generate_chinese_summary(text: str, max_length: int = 80, retries: int = 5) -> str:
    """
    为英文内容生成中文概述
    
    采用双重策略:
    1. 简单翻译（使用 Google Translate 非官方 API，带重试）
    2. 若失败则返回截断的原文并标记 [EN]
    
    Args:
        text: 英文原文
        max_length: 最大长度
        retries: 重试次数
    
    Returns:
        中文概述
    """
    if not text:
        return ""
    
    # 清理文本
    text = re.sub(r'https?://\S+', '', text)  # 移除链接
    text = re.sub(r'\s+', ' ', text).strip()  # 合并空白
    original_text = text[:500]  # 保留原文用于 fallback
    
    import time
    import random
    
    # 每次调用前随机延迟，避免频率限制
    time.sleep(random.uniform(0.3, 0.8))
    
    for attempt in range(retries):
        try:
            import httpx
            
            # Google Translate 非官方 API
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                'client': 'gtx',
                'sl': 'auto',  # 自动检测语言
                'tl': 'zh-CN',
                'dt': 't',
                'q': original_text
            }
            
            response = httpx.get(url, params=params, timeout=20)
            result = response.json()
            
            # 提取翻译结果
            if result and result[0]:
                translated = ''.join([part[0] for part in result[0] if part[0]])
                # 截断到合适长度
                if len(translated) > max_length:
                    translated = translated[:max_length-3] + '...'
                return translated
                
        except Exception as e:
            if attempt < retries - 1:
                wait_time = 1.0 * (attempt + 1) + random.uniform(0.5, 1.5)
                time.sleep(wait_time)  # 递增等待 + 随机抖动
            else:
                print(f"[WARN] 翻译失败 (重试 {retries} 次后): {e}")
    
    # 降级：返回截断的原文，标记 [EN]
    fallback = original_text[:max_length-8] + '...' if len(original_text) > max_length-5 else original_text
    return f"[EN] {fallback}"


# ============================================================================
#                           报告生成模块
# ============================================================================

def generate_report(
    arxiv_items: list[NewsItem],
    github_items: list[NewsItem],
    hn_items: list[NewsItem],
    output_dir: str,
    reddit_items: list[NewsItem] = None,
    twitter_items: list[NewsItem] = None,
    cg_items: list[NewsItem] = None,
    with_summary: bool = False,
    report_date: str = None
) -> str:
    """
    生成 Markdown 格式的新闻报告
    
    Args:
        arxiv_items: arXiv 论文列表
        github_items: GitHub 项目列表
        hn_items: HN 帖子列表
        output_dir: 输出目录
        reddit_items: Reddit 帖子列表
        twitter_items: Twitter 推文列表
        cg_items: CG 图形学相关条目列表
        with_summary: 是否生成中文概述
        report_date: 报告日期 (YYYY-MM-DD 格式)，默认为今天
    
    Returns:
        生成的报告文件路径
    """
    if report_date:
        today = datetime.datetime.strptime(report_date, '%Y-%m-%d').date()
    else:
        today = datetime.date.today()
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    reddit_items = reddit_items or []
    twitter_items = twitter_items or []
    cg_items = cg_items or []
    
    # 确保输出目录存在
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    filename = output_path / f"{today.isoformat()}.md"
    
    # 构建报告内容
    lines = [
        f"# 📰 AI & CG 每日资讯 - {today.isoformat()}",
        "",
        f"> 自动生成于 {timestamp}",
        "",
    ]
    
    # GitHub 部分
    if github_items:
        lines.extend([
            "## 🔥 GitHub Trending",
            "",
        ])
        if with_summary:
            lines.extend([
                "| 项目 | 中文描述 | 语言 | ⭐ 今日 | 链接 |",
                "|------|----------|------|--------|------|",
            ])
            for item in github_items[:10]:
                desc = generate_chinese_summary(item.summary, 50)
                today_stars = item.extra.get('today_stars', 0)
                lang = item.extra.get('language', 'Unknown')
                lines.append(f"| {item.title} | {desc} | {lang} | +{today_stars} | [Repo]({item.url}) |")
                

        else:
            lines.extend([
                "| 项目 | 描述 | 语言 | ⭐ 今日 | 链接 |",
                "|------|------|------|--------|------|",
            ])
            for item in github_items[:10]:
                desc = item.summary[:40] + '...' if len(item.summary) > 40 else item.summary
                today_stars = item.extra.get('today_stars', 0)
                lang = item.extra.get('language', 'Unknown')
                lines.append(f"| {item.title} | {desc} | {lang} | +{today_stars} | [Repo]({item.url}) |")
                

        lines.append("")
    
    # CG 图形学专属版块
    if cg_items:
        lines.extend([
            "## 🎨 CG 图形学",
            "",
            "> 覆盖: Unreal Engine | Three.js | Blender | Houdini | Unity | Godot | NVIDIA",
            "> 🏛️ = 官方源 | 🤖 = AI 相关",
            "",
        ])
        if with_summary:
            lines.extend([
                "| 中文概述 | 来源 | 标记 | 链接 |",
                "|----------|------|:----:|------|",
            ])
            for item in cg_items[:20]:
                summary = generate_chinese_summary(item.title, 50)
                label = item.category
                # 标记：官方源 + AI 相关
                marks = []
                if item.extra.get('is_official'):
                    marks.append("🏛️")
                if item.extra.get('is_ai_related'):
                    marks.append("🤖")
                mark_str = " ".join(marks)
                # 链接文本
                link_text = "官方" if item.extra.get('is_official') else "帖子"
                lines.append(f"| {summary} | {label} | {mark_str} | [{link_text}]({item.url}) |")
                

        else:
            lines.extend([
                "| 标题 | 领域 | AI | 热度 | 链接 |",
                "|------|------|:--:|------|------|",
            ])
            for item in cg_items[:15]:
                title = item.title[:50] + '...' if len(item.title) > 50 else item.title
                label = item.category
                is_ai = "🤖" if item.extra.get('is_ai_related') else ""
                lines.append(f"| {title} | {label} | {is_ai} | 🔥 {item.score} | [帖子]({item.url}) |")
                

        lines.append("")
    
    # Bluesky 部分（原 Twitter/X）
    if twitter_items:
        lines.extend([
            "## 🦋 Bluesky 动态",
            "",
        ])
        if with_summary:
            lines.extend([
                "| 中文概述 | 作者 | 链接 |",
                "|----------|------|------|",
            ])
            for item in twitter_items[:10]:
                summary = generate_chinese_summary(item.title, 60)
                lines.append(f"| {summary} | {item.category} | [原帖]({item.url}) |")
        else:
            lines.extend([
                "| 内容 | 作者 | 链接 |",
                "|------|------|------|",
            ])
            for item in twitter_items[:10]:
                title = item.title[:80] + '...' if len(item.title) > 80 else item.title
                lines.append(f"| {title} | {item.category} | [原帖]({item.url}) |")
        lines.append("")
    
    # Reddit 部分
    if reddit_items:
        lines.extend([
            "## 🔴 Reddit 讨论",
            "",
        ])
        if with_summary:
            lines.extend([
                "| 中文概述 | 社区 | 热度 | 链接 |",
                "|----------|------|------|------|",
            ])
            for item in reddit_items[:10]:
                summary = generate_chinese_summary(item.title, 60)
                lines.append(f"| {summary} | {item.category} | 🔥 {item.score} | [帖子]({item.url}) |")
                

        else:
            lines.extend([
                "| 标题 | 社区 | 热度 | 链接 |",
                "|------|------|------|------|",
            ])
            for item in reddit_items[:10]:
                title = item.title[:60] + '...' if len(item.title) > 60 else item.title
                lines.append(f"| {title} | {item.category} | 🔥 {item.score} | [帖子]({item.url}) |")
                

        lines.append("")
    
    # Hacker News 部分
    if hn_items:
        lines.extend([
            "## 💬 Hacker News 热议",
            "",
        ])
        if with_summary:
            lines.extend([
                "| 中文概述 | 分数 | 评论 | 链接 |",
                "|----------|------|------|------|",
            ])
            for item in hn_items[:10]:
                summary = generate_chinese_summary(item.title, 50)
                lines.append(f"| {summary} | {item.score} | {item.comments} | [讨论]({item.url}) |")
        else:
            lines.extend([
                "| 标题 | 分数 | 评论 | 链接 |",
                "|------|------|------|------|",
            ])
            for item in hn_items[:10]:
                title = item.title[:50] + '...' if len(item.title) > 50 else item.title
                lines.append(f"| {title} | {item.score} | {item.comments} | [讨论]({item.url}) |")
        lines.append("")
    
    # arXiv 学术前沿（放在最后）
    if arxiv_items:
        lines.extend([
            "## 🎓 学术前沿 (arXiv)",
            "",
        ])
        
        # 按分类分组
        categories = {}
        for item in arxiv_items:
            cat = item.category
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)
        
        for cat, cat_items in categories.items():
            if with_summary:
                lines.extend([
                    f"### {cat}",
                    "",
                    "| 中文概述 | 作者 | 链接 |",
                    "|----------|------|------|",
                ])
                for item in cat_items[:5]:
                    summary = generate_chinese_summary(item.title)
                    authors = item.authors[:25] + '...' if len(item.authors) > 25 else item.authors
                    lines.append(f"| {summary} | {authors} | [PDF]({item.url}) |")
            else:
                lines.extend([
                    f"### {cat}",
                    "",
                    "| 标题 | 作者 | 链接 |",
                    "|------|------|------|",
                ])
                for item in cat_items[:5]:
                    title = item.title[:60] + '...' if len(item.title) > 60 else item.title
                    authors = item.authors[:30] + '...' if len(item.authors) > 30 else item.authors
                    lines.append(f"| {title} | {authors} | [PDF]({item.url}) |")
            lines.append("")
    
    # 页脚
    lines.extend([
        "---",
        "*本报告由 AI & CG News Aggregator Skill 自动生成*",
    ])
    
    # 写入文件
    content = '\n'.join(lines)
    filename.write_text(content, encoding='utf-8')
    
    print(f"[OK] 报告已生成: {filename}")
    return str(filename)



# ============================================================================
#                              主程序入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='AI & CG 新闻聚合脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python fetch_news.py --all                    # 获取所有来源
  python fetch_news.py --source arxiv           # 仅获取 arXiv
  python fetch_news.py --source github          # 仅获取 GitHub Trending
  python fetch_news.py --source hackernews      # 仅获取 Hacker News
  python fetch_news.py --source reddit          # 仅获取 Reddit
  python fetch_news.py --source cg              # 仅获取 CG 图形学
  python fetch_news.py --source twitter         # 仅获取 Twitter/X
  python fetch_news.py --all --with-summary     # 全量获取 + 中文概述
  python fetch_news.py --all --output ./news    # 指定输出目录
  python fetch_news.py --all --date 2026-01-22  # 生成指定日期报告
        """
    )
    
    parser.add_argument('--all', action='store_true', help='获取所有来源')
    parser.add_argument('--source', choices=['arxiv', 'github', 'hackernews', 'reddit', 'cg', 'twitter'], 
                        help='指定单一来源')
    parser.add_argument('--categories', default='cs.AI,cs.GR,cs.CV', help='arXiv 分类（逗号分隔）')
    parser.add_argument('--days', type=int, default=1, help='获取最近几天的内容')
    parser.add_argument('--output', default=None, help='输出目录')
    parser.add_argument('--keywords', default='ai,graphics,gpu,rendering,neural,llm,diffusion', 
                        help='HN/Twitter 关键词')
    parser.add_argument('--with-summary', action='store_true', dest='with_summary',
                        default=True, help='为每条内容生成中文概述（默认开启）')
    parser.add_argument('--no-summary', action='store_false', dest='with_summary',
                        help='禁用中文概述生成')
    parser.add_argument('--date', default=None, 
                        help='报告日期 (YYYY-MM-DD 格式)，默认为今天')
    
    args = parser.parse_args()
    
    # 默认输出目录：相对于脚本位置的 ../daily_news/
    if args.output is None:
        script_dir = Path(__file__).parent.resolve()
        args.output = script_dir.parent / 'daily_news'
    
    arxiv_items = []
    github_items = []
    hn_items = []
    reddit_items = []
    twitter_items = []
    cg_items = []
    
    if args.all or args.source == 'arxiv':
        categories = args.categories.split(',')
        arxiv_items = fetch_arxiv(categories, args.days)
    
    if args.all or args.source == 'github':
        github_items = fetch_github(topics=['graphics', 'ai', 'rendering'])
    
    if args.all or args.source == 'hackernews':
        keywords = args.keywords.split(',')
        hn_items = fetch_hackernews(keywords)
    
    if args.all or args.source == 'reddit':
        reddit_items = fetch_reddit()
    
    if args.all or args.source == 'cg':
        cg_items = fetch_cg_graphics()
    
    # Bluesky/Twitter 已禁用（API 不稳定）
    # if args.all or args.source == 'twitter':
    #     twitter_items = fetch_twitter()
    
    # 生成报告
    has_content = arxiv_items or github_items or hn_items or reddit_items or twitter_items or cg_items
    if has_content:
        generate_report(
            arxiv_items, 
            github_items, 
            hn_items, 
            str(args.output),
            reddit_items=reddit_items,
            twitter_items=twitter_items,
            cg_items=cg_items,
            with_summary=args.with_summary,
            report_date=args.date
        )
    else:
        print("[WARN] 未获取到任何内容")
        sys.exit(1)



if __name__ == '__main__':
    main()
