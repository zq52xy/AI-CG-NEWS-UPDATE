"""
Check for nested news-card structures
"""
import re

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Split by news-card and check each one
parts = content.split('<div class="news-card">')
print(f"Total parts after split: {len(parts[1:])}")

# Check if any card contains another news-card
nested = 0
for i, part in enumerate(parts[1:], 1):
    # Find where this card ends
    end_divs = part.split('</div>')
    # Check if news-card appears inside
    if '<div class="news-card">' in part.split('</div></div></div>')[0] if '</div></div></div>' in part else False:
        nested += 1
        print(f"Card {i} may have nested structure")

# Check for news-grid wrappers
news_grids = len(re.findall(r'<div class="news-grid">', content))
print(f"\nTotal news-grid wrappers: {news_grids}")

# Check section structure
sections = content.split('## ')
for section in sections[1:]:
    header = section.split('\n')[0].strip()[:30]
    grids = section.count('<div class="news-grid">')
    cards = section.count('<div class="news-card">')
    print(f"{header}: {grids} grids, {cards} cards")
