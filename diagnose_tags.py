"""
Deep diagnostic for tag count duplication issue.
Checks both data file structure and counts.
"""
import re
from collections import Counter

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Count section headers
sections = re.findall(r'^## .+$', content, re.MULTILINE)
print("=== Section Headers ===")
for s in sections:
    print(f"  {s}")
print(f"Total sections: {len(sections)}")
print()

# Count news cards
cards = re.findall(r'<div class="news-card">', content)
print(f"=== Total news-card divs: {len(cards)} ===")
print()

# Count news-tags-data divs
tags_data = re.findall(r'<div class="news-tags-data"[^>]*>([^<]*)</div>', content)
print(f"=== news-tags-data divs: {len(tags_data)} ===")

# Count tags
all_tags = []
for td in tags_data:
    try:
        import json
        tags = json.loads(td) if td.strip() else []
        all_tags.extend(tags)
    except:
        pass

tag_counts = Counter(all_tags)
print("\n=== Tag Counts (from news-tags-data) ===")
for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
    print(f"  {tag}: {count}")

# Count visible .news-tag spans
visible_tags = re.findall(r'<span class="news-tag">([^<]+)</span>', content)
visible_tag_counts = Counter(visible_tags)
print("\n=== Visible Tag Counts (from .news-tag spans) ===")
for tag, count in sorted(visible_tag_counts.items(), key=lambda x: -x[1]):
    print(f"  {tag}: {count}")

# Check for conflict markers
markers = re.findall(r'<{7}|={7}|>{7}', content)
print(f"\n=== Conflict markers found: {len(markers)} ===")

# Check for duplicate titles
titles = re.findall(r'<h3 class="news-title">([^<]+)</h3>', content)
title_counts = Counter(titles)
duplicates = {t: c for t, c in title_counts.items() if c > 1}
if duplicates:
    print("\n=== Duplicate Titles ===")
    for t, c in duplicates.items():
        print(f"  '{t}': appears {c} times")
else:
    print("\n=== No duplicate titles found ===")
