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
    image_url: str = ""  # 新增图片链接字段
    tags: list = field(default_factory=list)  # 自动生成的标签
    extra: dict = field(default_factory=dict)



# ============================================================================
#                           配置加载模块
# ============================================================================

GLOBAL_CONFIG = {}

def load_config():
    """加载配置文件"""
    global GLOBAL_CONFIG
    script_dir = Path(__file__).parent.resolve()
    config_path = script_dir.parent / 'config.json'
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                GLOBAL_CONFIG = json.load(f)
            print(f"[INFO] 已加载配置文件: {config_path}")
        except Exception as e:
            print(f"[WARN] 配置文件加载失败: {e}")
    else:
        print(f"[INFO] 未找到配置文件，将使用默认内置规则")


def generate_tags(title: str, summary: str, source: str = "", category: str = "") -> list[str]:
    """
    根据关键词规则为新闻生成标签
    
    Args:
        title: 新闻标题
        summary: 新闻摘要
        source: 新闻来源（如 arXiv, GitHub）
        category: 新闻分类（如 cs.CV, r/blender）
    
    Returns:
        标签列表
    """
    tags = set()
    
    # 合并文本用于匹配
    text = f"{title} {summary} {category}".lower()
    
    # 从配置获取标签规则
    tag_rules = GLOBAL_CONFIG.get('tag_rules', {})
    
    # 规则匹配
    for tag_name, keywords in tag_rules.items():
        for keyword in keywords:
            if keyword.lower() in text:
                tags.add(tag_name)
                break  # 匹配到一个关键词即可，避免重复
    
    # 基于来源添加默认标签
    source_tags = {
        'arXiv': '论文/研究',
        'GitHub': '开源项目',
        'HackerNews': '行业动态',
        'Reddit': '社区讨论',
        'Reddit-CG': 'CG图形学',
        'Official': '官方资讯',
        'ProductHunt': '产品发布',
        'HuggingFace': '机器学习',
    }
    if source in source_tags:
        tags.add(source_tags[source])
    
    return list(tags)

# ============================================================================
#                           arXiv 抓取模块
# ============================================================================

def fetch_arxiv(categories: list[str], days: int = 1, max_results: int = 30) -> list[NewsItem]:
    """
    从 arXiv 获取最新论文（使用 Atom API，比 RSS 更稳定）
    """
    try:
        import feedparser
    except ImportError:
        print("[ERROR] 请安装 feedparser: pip install feedparser")
        return []
    
    items = []
    
    # 关键词过滤（使用配置）
    config = GLOBAL_CONFIG.get('sources', {}).get('arxiv', {})
    keywords = config.get('keywords', [
        'neural rendering', 'diffusion', 'transformer', 'ray tracing',
        'real-time', 'GPU', '3D', 'generative', 'NeRF', 'Gaussian',
        'language model', 'vision', 'multimodal', 'embodied'
    ])
    
    per_cat_limit = max(10, max_results // len(categories))
    
    for cat in categories:
        # 使用 Atom API
        url = f"https://export.arxiv.org/api/query?search_query=cat:{cat}&start=0&max_results={per_cat_limit}&sortBy=submittedDate&sortOrder=descending"
        print(f"[INFO] 正在获取 arXiv {cat}...")
        
        try:
            feed = feedparser.parse(url)
            
            if not feed.entries:
                rss_url = f"https://export.arxiv.org/rss/{cat}"
                print(f"[INFO] Atom API 无结果，尝试 RSS: {cat}")
                feed = feedparser.parse(rss_url)
            
            for entry in feed.entries[:per_cat_limit]:
                # 过滤黑名单
                if is_blacklisted(entry.title) or is_blacklisted(entry.get('summary', '')):
                    continue

                title = re.sub(r'^\([^)]+\)\s*', '', entry.title).strip()
                
                authors = entry.get('author', entry.get('authors', 'Unknown'))
                if isinstance(authors, list):
                    authors = ', '.join([a.get('name', str(a)) for a in authors[:3]])
                
                summary = entry.get('summary', '')[:200] + '...'
                
                link = entry.get('link', '')
                if isinstance(entry.get('links'), list) and entry.links:
                    for l in entry.links:
                        if l.get('type') == 'application/pdf':
                            link = l.get('href', link)
                            break
                
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
    
    items.sort(key=lambda x: x.score, reverse=True)
    return items[:max_results]


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
    
    # 从全局配置加载默认值
    config = GLOBAL_CONFIG.get('sources', {}).get('reddit', {})
    
    if subreddits is None:
        subreddits = config.get('subreddits', [
            'MachineLearning', 'GraphicsProgramming', 'computergraphics',
            'LocalLLaMA', 'artificial', 'unrealengine', 'unrealengine5', 'gamedev'
        ])
    
    if min_upvotes == 50 and config.get('min_upvotes'):
         min_upvotes = config.get('min_upvotes')

    items = []
    # 使用更真实的 User-Agent
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
                
                # 尝试提取图片
                image_url = ""
                preview = post_data.get('preview', {})
                images = preview.get('images', [])
                if images:
                    image_url = images[0].get('source', {}).get('url', '').replace('&amp;', '&')
                elif post_data.get('thumbnail') and post_data.get('thumbnail').startswith('http'):
                    image_url = post_data.get('thumbnail')

                items.append(NewsItem(
                    title=title,
                    url=f"https://www.reddit.com{permalink}",
                    source='Reddit',
                    category=f"r/{sub}",
                    score=score,
                    comments=comments,
                    image_url=image_url,
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
#                        Product Hunt 抓取模块
# ============================================================================

def fetch_product_hunt(limit: int = 15) -> list[NewsItem]:
    """
    从 Product Hunt 获取热门产品 (RSS)
    """
    try:
        import feedparser
    except ImportError:
        print("[ERROR] 请安装 feedparser: pip install feedparser")
        return []

    config = GLOBAL_CONFIG.get('sources', {}).get('product_hunt', {})
    if not config.get('enabled', True):
        return []

    url = config.get('rss_url', 'https://www.producthunt.com/feed')
    min_votes = config.get('min_votes', 0)

    print(f"[INFO] 正在获取 Product Hunt...")
    
    items = []
    try:
        # 添加 User-Agent防止被拦截
        feed = feedparser.parse(url, agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-CG-NewsBot/1.0')
        for entry in feed.entries[:limit]:
            title = entry.title
            link = entry.link
            content = entry.get('summary', '') or entry.get('content', [{}])[0].get('value', '')
            
            # 提取投票数
            score = 0
            votes_match = re.search(r'Votes: (\d+)', content)
            if votes_match:
                score = int(votes_match.group(1))
            
            if score < min_votes:
                continue

            # 提取图片
            image_url = ""
            img_match = re.search(r'img src="([^"]+)"', content)
            if img_match:
                image_url = img_match.group(1)
            
            # 清理摘要 HTML
            summary = re.sub(r'<[^>]+>', '', content).strip()
            # 移除结尾的 "Comments: X, Votes: Y"
            summary = re.sub(r'Comments: \d+, Votes: \d+.*$', '', summary).strip()
            
            items.append(NewsItem(
                title=title,
                url=link,
                source='ProductHunt',
                category='Product',
                score=score,
                summary=summary[:200],
                image_url=image_url
            ))
            
    except Exception as e:
        print(f"[WARN] 获取 Product Hunt 失败: {e}")
        
    return items

# ============================================================================
#                     Trending Skills 抓取模块 (skills.sh)
# ============================================================================

def fetch_trending_skills(limit: int = 15) -> list[NewsItem]:
    """
    从 skills.sh 获取热门 AI Agent 技能
    """
    try:
        import httpx
        from bs4 import BeautifulSoup
    except ImportError:
        print("[ERROR] 请安装依赖: pip install httpx beautifulsoup4")
        return []
    
    # 检查配置是否启用
    config = GLOBAL_CONFIG.get('sources', {}).get('trending_skills', {})
    if not config.get('enabled', False):
         return []
    
    limit = config.get('limit', limit)
    
    print("[INFO] 正在获取 Trending Skills (skills.sh)...")
    url = "https://skills.sh/trending"
    items = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = httpx.get(url, headers=headers, timeout=30)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 简单文本行分析 (参考原 repo 逻辑)
        text = soup.get_text("\n", strip=True)
        lines = text.split('\n')
        
        start_parsing = False
        parsed_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # 定位榜单开始
            if "Leaderboard" in line or "Skills Leaderboard" in line:
                start_parsing = True
                i += 1
                continue
            
            if not start_parsing:
                i += 1
                continue
                
            # 尝试匹配 Rank (数字)
            if line.isdigit():
                try:
                    rank = int(line)
                    if i + 1 < len(lines):
                        name = lines[i+1]
                        # 简单的验证: name 应该是 kebab-case
                        if not re.match(r'^[a-z0-9-]+$', name):
                             i += 1
                             continue

                        # Owner/Repo (下一行)
                        owner_repo = ""
                        if i + 2 < len(lines):
                            owner_repo = lines[i+2]
                        
                        # 构造 item
                        # URL 格式: https://skills.sh/{owner}/{repo}/{skill_name}
                        url = f"https://skills.sh/{owner_repo}/{name}"
                        
                        items.append(NewsItem(
                            title=name,
                            url=url,
                            source='Skills.sh',
                            category='Agent Skill',
                            score=100 - parsed_count, # 模拟分数
                            summary=f"Rank #{rank} on skills.sh. Owner: {owner_repo}",
                            extra={'rank': rank, 'owner': owner_repo}
                        ))
                        parsed_count += 1
                        
                        if parsed_count >= limit:
                            break
                        
                        # 跳过已处理的行
                        i += 3
                        continue
                except:
                    pass
            
            i += 1
            
    except Exception as e:
        print(f"[WARN] 获取 Trending Skills 失败: {e}")
        
    items.sort(key=lambda x: x.extra.get('rank', 999))
    return items

def fetch_huggingface_papers(limit: int = 10) -> list[NewsItem]:
    """
    从 Hugging Face Daily Papers 获取热门论文
    """
    try:
        import httpx
    except ImportError:
        print("[ERROR] 请安装 httpx: pip install httpx")
        return []

    config = GLOBAL_CONFIG.get('sources', {}).get('huggingface', {})
    if not config.get('enabled', True):
        return []
    
    limit = config.get('limit', limit)
    url = "https://huggingface.co/api/daily_papers"
    print(f"[INFO] 正在获取 Hugging Face Daily Papers...")
    
    items = []
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = httpx.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # data 是一个列表，每个元素包含 'paper' 键
        for entry in data[:limit]:
            paper = entry.get('paper', {})
            title = paper.get('title', 'Untitled')
            paper_id = paper.get('id', '')
            link = f"https://huggingface.co/papers/{paper_id}" if paper_id else "https://huggingface.co/papers"
            
            summary = paper.get('summary', '')
            # 优先使用 ai_summary 如果有
            if paper.get('ai_summary'):
                summary = paper.get('ai_summary')

            upvotes = paper.get('upvotes', 0)
            thumbnail = paper.get('thumbnail', '')
            
            # 作者处理
            authors = paper.get('authors', [])
            author_names = [a.get('name', 'Unknown') for a in authors[:3]]
            author_str = ", ".join(author_names)
            
            items.append(NewsItem(
                title=title,
                url=link,
                source='HuggingFace',
                category='Paper',
                summary=summary,
                score=upvotes,
                date=paper.get('publishedAt', ''),
                extra={
                    'thumbnail': thumbnail,
                    'upvotes': upvotes,
                    'is_hf': True
                }
            ))
            
    except Exception as e:
        print(f"[WARN] 获取 Hugging Face Papers 失败: {e}")
        
    items.sort(key=lambda x: x.score, reverse=True)
    return items


# ============================================================================
#                        智能过滤模块
# ============================================================================

def is_blacklisted(text: str) -> bool:
    """检查文本是否包含黑名单关键词"""
    if not text:
        return False
    
    blacklist = GLOBAL_CONFIG.get('filtering', {}).get('exclude_keywords', [])
    if not blacklist:
        # 默认黑名单
        blacklist = ["blockchain", "crypto", "nft", "web3", "bitcoin", "ethereum", "token"]
        
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in blacklist)

def deduplicate_items(items: list[NewsItem]) -> list[NewsItem]:
    """去重：保留分数最高的 URL"""
    if not GLOBAL_CONFIG.get('filtering', {}).get('deduplicate', True):
        return items
        
    seen_urls = {}
    unique_items = []
    
    for item in items:
        # 归一化 URL (移除末尾斜杠，移除 utm 参数等简单处理)
        url = item.url.split('?')[0].rstrip('/')
        
        if url in seen_urls:
            existing_item = seen_urls[url]
            # 如果当前项分数更高，替换（但这里逻辑稍微复杂，因为 items 列表顺序问题）
            # 简单起见，我们优先保留先出现的（通常各源内部已按热度排序），或者合并信息
            # 这里选择保留第一个
            continue
        
        seen_urls[url] = item
        unique_items.append(item)
        
    return unique_items


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

def _generate_html_card(item: NewsItem, summary: str, meta_left: str, meta_right: str) -> str:
    """生成 Quora 风格的新闻卡片 HTML"""
    
    # 默认图片（如果是 GitHub，使用 OpenGraph）
    image_html = ""
    if item.image_url:
        image_html = f'<div class="news-card-image" style="background-image: url(\'{item.image_url}\')"></div>'
    elif item.source == 'GitHub':
        # GitHub OpenGraph Image 构造
        try:
            repo_path = item.url.replace('https://github.com/', '')
            og_url = f"https://opengraph.githubassets.com/1/{repo_path}"
            image_html = f'<div class="news-card-image" style="background-image: url(\'{og_url}\')"></div>'
        except:
            pass
    
    # 布局决定：如果有图片，使用带图片的布局；否则使用纯文本布局
    has_image_class = " has-image" if image_html else ""
    
    # 生成标签（如果 item 没有标签，则现场生成）
    tags = item.tags if item.tags else generate_tags(item.title, item.summary, item.source, item.category)
    # tags_json = json.dumps(tags, ensure_ascii=False) # This line is removed as per the change
    
    # 标签 HTML（小徽章形式）
    tags_html = ""
    if tags:
        tag_badges = " ".join([f'<span class="news-tag">{tag}</span>' for tag in tags[:3]])  # 最多显示3个
        tags_html = f'<div class="news-tags">{tag_badges}</div>'
    
    # 生成 HTML
    # 注意：我们将标签数据放在一个隐藏的 div 中，而不是父 div 的 data-tags 属性
    # 因为某些 Markdown 解析器（如 marked.js）可能会在这个过程中剥离 data- 属性
    tags_json = json.dumps(item.tags, ensure_ascii=False)
    
    html = f"""
<div class="news-card{' has-image' if item.image_url else ''}">
    <div class="news-tags-data" style="display:none">{tags_json}</div>
    <div class="news-card-content">
        <div class="news-card-header">
            <span class="news-source-tag">{item.source}</span>
            <span class="news-date">{item.date}</span>
        </div>
        <a href="{item.url}" target="_blank" class="news-title-link">
            <h3 class="news-title">{item.title}</h3>
        </a>
        <div class="news-summary">{item.summary}</div>
        {tags_html}
        <div class="news-meta">
            <span class="meta-left">{meta_left}</span>
            <span class="meta-right">{meta_right}</span>
        </div>
    </div>
    {"<div class=\"news-card-image\" style=\"background-image: url(\'" + item.image_url + "\');\"></div>" if item.image_url else ""}</div>
"""
    return html

def generate_report(
    arxiv_items: list[NewsItem],
    github_items: list[NewsItem],
    hn_items: list[NewsItem],
    output_dir: str,
    reddit_items: list[NewsItem] = None,
    twitter_items: list[NewsItem] = None,
    cg_items: list[NewsItem] = None,
    ph_items: list[NewsItem] = None,
    trending_skills_items: list[NewsItem] = None,
    hf_items: list[NewsItem] = None, # Added
    with_summary: bool = False,
    report_date: str = None
) -> str:
    """
    生成 Markdown 格式的新闻报告 (嵌入 HTML 卡片)
    """
    if report_date:
        today = datetime.datetime.strptime(report_date, '%Y-%m-%d').date()
    else:
        today = datetime.date.today()
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    reddit_items = reddit_items or []
    twitter_items = twitter_items or []
    cg_items = cg_items or []
    hf_items = hf_items or []
    
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
            "![GitHub Trending](../img/github.png)",
            '<div class="news-grid">',
        ])
        for item in github_items[:10]:
            if with_summary:
                desc = generate_chinese_summary(item.summary, 60)
            else:
                desc = item.summary[:60] + '...'
            
            today_stars = item.extra.get('today_stars', 0)
            lang = item.extra.get('language', 'Unknown')
            
            card = _generate_html_card(
                item, 
                desc, 
                f"🔤 {lang}", 
                f"⭐ +{today_stars}"
            )
            lines.append(card)
            
        lines.append('</div>') # End grid
        lines.append("")
    
    # CG 图形学专属版块
    
    # Trending Skills 部分
    if trending_skills_items:
        lines.extend([
            "## 🛠️ Trending Skills for Agents",
            "![Trending Skills](../img/skills.png)",
            "> Top Agent Skills from skills.sh",
            '<div class="news-grid">',
        ])
        for item in trending_skills_items[:10]:
            if with_summary:
                # 技能描述通常很短，或者不如 title 重要
                summary = item.summary
            else:
                 summary = item.summary
            
            card = _generate_html_card(
                item,
                summary,
                "🤖 Skill",
                f"#{item.extra.get('rank', 0)}"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")

    # Hugging Face 部分
    if hf_items:
        lines.extend([
            "## 🤗 Hugging Face Papers",
            "![Hugging Face](../img/Hugging%20Face.png)",
            "> Daily Top Papers from hf.co/papers",
            '<div class="news-grid">',
        ])
        for item in hf_items[:10]:
            if with_summary:
                summary = generate_chinese_summary(item.summary, 80)
            else:
                summary = item.summary[:100] + '...'
            
            thumb = item.extra.get('thumbnail', '')
            upvotes = item.extra.get('upvotes', 0)
            
            # 如果有缩略图，可以考虑在卡片中显示，这里暂时用标准卡片
            # 可以在 meta 中加图片标记
            meta_left = "📄 Paper"
            
            card = _generate_html_card(
                item,
                summary,
                meta_left,
                f"👍 {upvotes}"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")

    # Product Hunt 部分
    if ph_items:
        lines.extend([
            "## 🚀 Product Hunt 每日精选",
            "![Product Hunt](../img/product%20hunt.png)",
            '<div class="news-grid">',
        ])
        for item in ph_items[:10]:
            if with_summary:
                summary = generate_chinese_summary(item.summary, 80)
            else:
                summary = item.summary[:80] + '...'
            
            card = _generate_html_card(
                item,
                summary,
                "🆕 Product",
                f"▲ {item.score}"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")

    if cg_items:
        lines.extend([
            "## 🎨 CG 图形学",
            "![CG 图形学](../img/CG.png)",
            "> 覆盖: Unreal Engine | Three.js | Blender | Houdini | Unity | Godot | NVIDIA",
            "",
            '<div class="news-grid">',
        ])
        for item in cg_items[:20]:
            if with_summary:
                summary_text = generate_chinese_summary(item.title, 80)
            else:
                summary_text = item.summary[:80] + '...'
            
            # 标记
            marks = []
            if item.extra.get('is_official'): marks.append("🏛️ 官方")
            if item.extra.get('is_ai_related'): marks.append("🤖 AI")
            meta_left = " ".join(marks) if marks else "🔥 热门"
            
            card = _generate_html_card(
                item,
                summary_text,
                meta_left,
                f"🔥 {item.score}"
            )
            lines.append(card)
            
        lines.append('</div>')
        lines.append("")
    
    # Bluesky 部分
    if twitter_items:
        lines.extend([
            "## 🦋 Bluesky 动态",
            '<div class="news-grid">',
        ])
        for item in twitter_items[:10]:
            if with_summary:
                summary = generate_chinese_summary(item.title, 80)
            else:
                summary = item.title[:80] + '...'
            
            card = _generate_html_card(
                item,
                summary,
                "👤 KOL",
                "[原帖]"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")
    
    # Reddit 部分
    if reddit_items:
        lines.extend([
            "## 🔴 Reddit 讨论",
            "![Reddit 讨论](../img/reddit.png)",
            '<div class="news-grid">',
        ])
        for item in reddit_items[:10]:
            if with_summary:
                summary = generate_chinese_summary(item.title, 80)
            else:
                summary = item.title[:80] + '...'
            
            card = _generate_html_card(
                item,
                summary,
                f"r/{item.extra.get('subreddit')}",
                f"🔥 {item.score}"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")
    
    # Hacker News 部分
    if hn_items:
        lines.extend([
            "## 💬 Hacker News 热议",
            "![Hacker News](../img/Hacker%20News.png)",
            '<div class="news-grid">',
        ])
        for item in hn_items[:10]:
            if with_summary:
                summary = generate_chinese_summary(item.title, 80)
            else:
                summary = item.title[:80] + '...'
            
            card = _generate_html_card(
                item,
                summary,
                f"💬 {item.comments} 评论",
                f"Points: {item.score}"
            )
            lines.append(card)
        lines.append('</div>')
        lines.append("")
    
    # arXiv 学术前沿
    if arxiv_items:
        lines.extend([
            "## 🎓 学术前沿 (arXiv)",
            "![学术前沿](../img/arXiv.png)",
            '<div class="news-grid">',
        ])
        for item in arxiv_items[:10]: # 限制数量
            if with_summary:
                summary = generate_chinese_summary(item.title, 100)
            else:
                summary = item.title[:100] + '...'
            
            authors = item.authors[:30] + '...' if len(item.authors) > 30 else item.authors
            
            card = _generate_html_card(
                item,
                summary,
                f"✍️ {authors}",
                "📄 PDF"
            )
            lines.append(card)
        lines.append('</div>')
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
    # 加载配置
    load_config()

    parser = argparse.ArgumentParser(
        description='AI & CG 新闻聚合脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python fetch_news.py --all                    # 获取所有来源
"""
    )
    
    parser.add_argument('--all', action='store_true', help='获取所有来源')
    parser.add_argument('--source', 
        choices=['arxiv', 'github', 'hn', 'reddit', 'bluesky', 'cg', 'ph', 'trending_skills', 'huggingface'],
        help='指定只获取某个源')
    parser.add_argument('--categories', default=None, help='arXiv 分类（逗号分隔）')
    parser.add_argument('--days', type=int, default=1, help='获取最近几天的内容')
    parser.add_argument('--output', default=None, help='输出目录')
    parser.add_argument('--keywords', default=None, help='HN/Twitter 关键词')
    parser.add_argument('--with-summary', action='store_true', dest='with_summary',
                        default=True, help='为每条内容生成中文概述（默认开启）')
    parser.add_argument('--no-summary', action='store_false', dest='with_summary',
                        help='禁用中文概述生成')
    parser.add_argument('--date', default=None, 
                        help='报告日期 (YYYY-MM-DD 格式)，默认为今天')
    
    args = parser.parse_args()
    
    if args.output is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        args.output = os.path.join(os.path.dirname(script_dir), 'daily_news')
    
    arxiv_items = []
    github_items = []
    hn_items = []
    reddit_items = []
    twitter_items = []
    cg_items = []
    ph_items = []
    skills_items = []
    hf_papers_items = []
    
    # 优先使用 CLI 参数，其次使用配置，最后默认
    if args.categories:
        categories = args.categories.split(',')
    else:
        categories = GLOBAL_CONFIG.get('sources', {}).get('arxiv', {}).get('categories', ['cs.AI', 'cs.GR', 'cs.CV'])

    if args.all or args.source == 'arxiv':
        arxiv_items = fetch_arxiv(categories, args.days)
    
    if args.all or args.source == 'github':
        # GitHub 配置
        config = GLOBAL_CONFIG.get('sources', {}).get('github', {})
        # Note: fetch_github needs refactoring too, but for now we pass kwargs or modify it
        # Actually fetch_github calls are simple
        github_items = fetch_github(topics=['graphics', 'ai', 'rendering'])
    
    if args.all or args.source == 'hackernews':
        if args.keywords:
            keywords = args.keywords.split(',')
        else:
            keywords = GLOBAL_CONFIG.get('sources', {}).get('hackernews', {}).get('keywords', ['ai', 'graphics'])
        hn_items = fetch_hackernews(keywords)
    
    if args.all or args.source == 'reddit':
        reddit_items = fetch_reddit()
    
    if args.all or args.source == 'cg':
        cg_items = fetch_cg_graphics()
    
    if args.all or args.source == 'producthunt':
        ph_items = fetch_product_hunt()

    if args.all or args.source == 'trending_skills':
        skills_items = fetch_trending_skills()
    
    if args.all or args.source == 'huggingface':
        hf_papers_items = fetch_huggingface_papers()

    # 合并所有 items 进行去重
    all_content = []
    all_content.extend(arxiv_items)
    all_content.extend(github_items)
    all_content.extend(hn_items)
    all_content.extend(reddit_items)
    all_content.extend(twitter_items) # Note: twitter_items is alias for bluesky_items
    all_content.extend(cg_items)
    all_content.extend(ph_items)
    all_content.extend(skills_items)
    all_content.extend(hf_papers_items)
    
    # 去重
    all_content = deduplicate_items(all_content)
    
    # 生成报告
    has_content = any(all_content)
    if has_content:
        generate_report(
            arxiv_items, 
            github_items, 
            hn_items, 
            str(args.output),
            reddit_items=reddit_items,
            twitter_items=twitter_items,
            cg_items=cg_items,
            ph_items=ph_items,
            trending_skills_items=skills_items,
            hf_items=hf_papers_items,
            with_summary=args.with_summary,
            report_date=args.date
        )
    else:
        print("[WARN] 未获取到任何内容")
        sys.exit(1)



if __name__ == '__main__':
    main()
