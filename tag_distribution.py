"""
Full tag analysis per section
"""
import re
import json
from collections import defaultdict

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Collect all tags with their section
tag_sections = defaultdict(list)

sections = content.split('## ')
for section in sections[1:]:
    header = section.split('\n')[0].strip()[:30]
    pattern = r'<div class="news-tags-data"[^>]*>(\[[^\]]*\])</div>'
    matches = re.findall(pattern, section)
    for m in matches:
        try:
            tags = json.loads(m)
            for tag in tags:
                tag_sections[tag].append(header)
        except:
            pass

# Print summary
print("=== Tag distribution across sections ===")
for tag, sections in sorted(tag_sections.items(), key=lambda x: -len(x[1])):
    section_counts = defaultdict(int)
    for s in sections:
        section_counts[s] += 1
    details = ", ".join([f"{s}:{c}" for s, c in section_counts.items()])
    print(f"{tag} ({len(sections)}): {details}")
