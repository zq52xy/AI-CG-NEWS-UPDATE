"""
Find exact duplication pattern in news-tags-data
"""
import re
import json
from collections import Counter

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all news-tags-data entries with their line numbers
pattern = r'<div class="news-tags-data"[^>]*>([^<]*)</div>'
matches = list(re.finditer(pattern, content))

print(f"Total news-tags-data divs found: {len(matches)}")

# Check for duplicate content
tag_data_list = []
for m in matches:
    line_num = content[:m.start()].count('\n') + 1
    tag_data = m.group(1).strip()
    tag_data_list.append((line_num, tag_data))

# Count unique vs total
unique_data = set([t[1] for t in tag_data_list])
print(f"Unique tag data values: {len(unique_data)}")
print(f"Duplicate entries: {len(tag_data_list) - len(unique_data)}")

# Check specific tag
print("\n=== Lines with 论文/研究 tag ===")
count = 0
for line_num, data in tag_data_list:
    if '论文/研究' in data:
        count += 1
        print(f"  Line {line_num}: {data[:50]}...")

print(f"\nTotal 论文/研究 entries: {count}")

# Check if there are duplicate cards (same title)
titles = re.findall(r'<h3 class="news-title">([^<]+)</h3>', content)
title_counts = Counter(titles)
duplicates = {t: c for t, c in title_counts.items() if c > 1}

if duplicates:
    print("\n=== Duplicate Titles ===")
    for t, c in duplicates.items():
        print(f"  '{t}': appears {c} times")
else:
    print("\n=== No duplicate titles ===")

# Count cards per section
print("\n=== Cards per section ===")
sections = re.split(r'^## ', content, flags=re.MULTILINE)
for i, section in enumerate(sections[1:], 1):
    lines = section.split('\n')
    header = lines[0] if lines else 'Unknown'
    card_count = section.count('<div class="news-card">')
    tags_count = len(re.findall(pattern, section))
    print(f"  {header[:40]}: {card_count} cards, {tags_count} tag-data divs")
