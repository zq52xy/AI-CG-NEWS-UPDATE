
import re

file_path = 'daily_news/2026-01-31.md'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Check for conflict markers
markers = [i+1 for i, line in enumerate(lines) if '<<<<<<<' in line or '=======' in line or '>>>>>>>' in line]
print(f"Conflict markers at lines: {markers}")

# Check for 'Trending Skills' header
headers = [i+1 for i, line in enumerate(lines) if 'Trending Skills' in line]
print(f"'Trending Skills' at lines: {headers}")

# Check for 'find-skills'
items = [i+1 for i, line in enumerate(lines) if 'find-skills' in line]
print(f"'find-skills' at lines: {items}")

# Check for 'openclaw'
openclaw = [i+1 for i, line in enumerate(lines) if 'openclaw' in line]
print(f"'openclaw' at lines: {openclaw}")
