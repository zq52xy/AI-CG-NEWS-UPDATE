
import json
import re
import feedparser
from dataclasses import dataclass, field

@dataclass
class NewsItem:
    title: str
    url: str
    source: str
    category: str
    score: int = 0
    comments: int = 0
    authors: str = ""
    summary: str = ""
    date: str = ""
    image_url: str = ""
    extra: dict = field(default_factory=dict)

GLOBAL_CONFIG = {}

def load_config():
    with open('config.json', 'r', encoding='utf-8') as f:
        global GLOBAL_CONFIG
        GLOBAL_CONFIG = json.load(f)

def fetch_product_hunt(limit: int = 15):
    load_config()
    config = GLOBAL_CONFIG.get('sources', {}).get('product_hunt', {})
    url = config.get('rss_url', 'https://www.producthunt.com/feed')
    min_votes = config.get('min_votes', 0)
    
    print(f"Config: URL={url}, MinVotes={min_votes}")

    try:
        # User-Agent check
        agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-CG-NewsBot/1.0'
        print(f"Fetching with agent: {agent}")
        feed = feedparser.parse(url, agent=agent)
        
        print(f"Feed status: {getattr(feed, 'status', 'Unknown')}")
        print(f"Feed entries: {len(feed.entries)}")
        
        if hasattr(feed, 'bozo_exception'):
             print(f"Bozo exception: {feed.bozo_exception}")

        if len(feed.entries) > 0:
             print(f"First entry keys: {feed.entries[0].keys()}")

        for entry in feed.entries[:limit]:
            print(f"Entry: {entry.title}")
            content = entry.get('summary', '') or entry.get('content', [{}])[0].get('value', '')
            if entry == feed.entries[0]:
                print(f"--- RAW CONTENT START ---\n{content}\n--- RAW CONTENT END ---")
            
            votes_match = re.search(r'Votes: (\d+)', content)
            score = 0
            if votes_match:
                score = int(votes_match.group(1))
            print(f"  - Score: {score}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_product_hunt()
