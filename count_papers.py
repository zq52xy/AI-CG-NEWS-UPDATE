"""
Count actual cards with 论文/研究 tag
"""
import re
import json

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all news-tags-data JSON content
pattern = r'<div class="news-tags-data"[^>]*>(\[[^\]]*\])</div>'
matches = re.findall(pattern, content)

count_papers = 0
for m in matches:
    try:
        tags = json.loads(m)
        if '论文/研究' in tags:
            count_papers += 1
    except:
        pass

print(f"Cards with 论文/研究 in news-tags-data JSON: {count_papers}")

# Now check where 论文/研究 appears in visible spans
visible_cards = content.split('<div class="news-card">')
papers_visible = 0
for card in visible_cards[1:]:
    if '<span class="news-tag">论文/研究</span>' in card:
        papers_visible += 1

print(f"Cards with visible 论文/研究 span: {papers_visible}")

# Check if there are duplicate hidden entries
print("\n=== All hidden tag data containing 论文/研究 ===")
for i, m in enumerate(matches):
    try:
        tags = json.loads(m)
        if '论文/研究' in tags:
            print(f"  {i+1}. {tags}")
    except:
        pass
