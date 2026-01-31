"""
Deep diagnostic for tag count duplication issue.
"""
import re
import json
from collections import Counter

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Count news cards
cards = re.findall(r'<div class="news-card">', content)
print(f"Total news-card divs: {len(cards)}")

# Extract and count tags from news-tags-data
tags_data_matches = re.findall(r'<div class="news-tags-data"[^>]*>([^<]*)</div>', content)
print(f"Total news-tags-data divs: {len(tags_data_matches)}")

all_tags_from_data = []
for td in tags_data_matches:
    try:
        tags = json.loads(td) if td.strip() else []
        all_tags_from_data.extend(tags)
    except:
        pass

tag_counts_from_data = Counter(all_tags_from_data)
print("\n=== Tag Counts (from news-tags-data JSON) ===")
for tag, count in sorted(tag_counts_from_data.items(), key=lambda x: -x[1]):
    print(f"  {tag}: {count}")

# Extract and count visible .news-tag spans
visible_tags = re.findall(r'<span class="news-tag">([^<]+)</span>', content)
visible_tag_counts = Counter(visible_tags)
print(f"\n=== Visible Tag Counts (from .news-tag spans) ===")
for tag, count in sorted(visible_tag_counts.items(), key=lambda x: -x[1]):
    print(f"  {tag}: {count}")

# Check if hidden and visible tags are the same
print(f"\n=== Comparison ===")
print(f"Hidden tags total: {len(all_tags_from_data)}")
print(f"Visible tags total: {len(visible_tags)}")
print(f"Difference: {len(all_tags_from_data) - len(visible_tags)}")

# Check specific tags
print(f"\n=== Specific Tag Analysis ===")
for tag in ['开源项目', '论文/研究', '产品发布', 'AI Agent']:
    hidden = tag_counts_from_data.get(tag, 0)
    visible = visible_tag_counts.get(tag, 0)
    print(f"  {tag}: hidden={hidden}, visible={visible}, diff={hidden - visible}")
