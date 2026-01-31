"""
Check all sections properly
"""
import re

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Count total
cards = len(re.findall(r'<div class="news-card">', content))
tags = len(re.findall(r'<div class="news-tags-data"', content))
print(f"TOTAL: {cards} cards, {tags} tag-data divs")

# Per section
sections = content.split('## ')
print("\n=== Per Section ===")
for section in sections[1:]:
    header = section.split('\n')[0].strip()[:40]
    c = section.count('<div class="news-card">')
    t = section.count('<div class="news-tags-data"')
    print(f"{header}: {c} cards, {t} tags")

# Check for 论文/研究 in hidden data vs visible
hidden = len(re.findall(r'论文/研究', content))
visible_in_span = len(re.findall(r'<span class="news-tag">论文/研究</span>', content))
print(f"\n论文/研究 total occurrences in file: {hidden}")
print(f"论文/研究 in visible spans: {visible_in_span}")
