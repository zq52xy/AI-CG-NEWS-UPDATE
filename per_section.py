"""
Count 论文/研究 per section
"""
import re
import json

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

sections = content.split('## ')
print("=== 论文/研究 per section ===")
total = 0
for section in sections[1:]:
    header = section.split('\n')[0].strip()[:40]
    # Count in hidden JSON
    pattern = r'<div class="news-tags-data"[^>]*>(\[[^\]]*\])</div>'
    matches = re.findall(pattern, section)
    count = 0
    for m in matches:
        try:
            tags = json.loads(m)
            if '论文/研究' in tags:
                count += 1
        except:
            pass
    # Count in visible spans
    visible = section.count('<span class="news-tag">论文/研究</span>')
    print(f"{header}: hidden={count}, visible={visible}")
    total += count

print(f"\nTotal hidden 论文/研究: {total}")
