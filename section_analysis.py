"""
Find exact duplication pattern in news-tags-data
"""
import re
import json
from collections import Counter

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Count cards per section
print("=== Cards per section ===")
pattern = r'<div class="news-tags-data"[^>]*>([^<]*)</div>'
sections = re.split(r'^## ', content, flags=re.MULTILINE)
for i, section in enumerate(sections[1:], 1):
    lines = section.split('\n')
    header = lines[0].strip() if lines else 'Unknown'
    card_count = section.count('<div class="news-card">')
    tags_count = len(re.findall(pattern, section))
    print(f"{header[:50]}: cards={card_count}, tag-divs={tags_count}")

# Count 论文/研究 specifically
print("\n=== 论文/研究 analysis ===")
tags_data = re.findall(pattern, content)
count = 0
for td in tags_data:
    if '论文/研究' in td:
        count += 1
print(f"Total news-tags-data containing 论文/研究: {count}")

# Check visible news-tag spans
visible_pattern = r'<span class="news-tag">论文/研究</span>'
visible_count = len(re.findall(visible_pattern, content))
print(f"Total visible .news-tag spans with 论文/研究: {visible_count}")
