
import re

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace empty tags [] with ["AI Agent", "Skill"] in news-tags-data divs
# We use regex to be robust against spacing
pattern = r'(<div class="news-tags-data" style="display:none">)\s*\[\]\s*(</div>)'
replacement = r'\1["AI Agent", "Skill"]\2'

new_content, count = re.subn(pattern, replacement, content)

print(f"Replaced {count} occurrences.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
