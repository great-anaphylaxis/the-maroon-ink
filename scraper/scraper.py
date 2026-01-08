import os
from pathlib import Path
import requests
import json
import time
import uuid
import re
import unicodedata
from datetime import datetime
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()

# --- CONFIGURATION ---
PAGE_TOKEN = os.getenv('FB_PAGE_ACCESS_TOKEN') 
PAGE_ID = os.getenv('PAGE_ID') 

# Testing limit for media per post
MAX_MEDIA_PER_POST = 3 
# Speed setting: Number of simultaneous downloads
MAX_WORKERS = 15 

MEDIA_FOLDER = Path('media')
MEDIA_FOLDER.mkdir(exist_ok=True)
LAST_SCRAPE_FILE = "last_scrape.txt"
DEBUG_FILE = "extraction_debug.txt"

# --- REGEX PATTERNS ---
SPECIFIC_ROLES = ["illustrat", "cartoon", "graphic", "photo", "photos", "writ", "layout", "art", "contribut", "report"]

CREDIT_RE = re.compile(
    r'^(?:by|By)\s*:?|' + 
    r'|'.join([rf'^{role}\w*\s+by\s*:?' for role in SPECIFIC_ROLES]) + 
    r'|'.join([rf'\b{role}\w*\s+by\s*:' for role in SPECIFIC_ROLES]), 
    re.IGNORECASE
)

INKER_KEYWORDS = ["journalists on duty", "jounalist on duty", "inker on duty", "inkers on duty", "production team"]
INKER_RE = re.compile(r'|'.join([rf'\b{re.escape(kw)}\s*:?' for kw in INKER_KEYWORDS]), re.IGNORECASE)

INKER_BLACKLIST = {
    "the", "school", "page", "news", "event", "uimhs", "campus", 
    "editorial", "official", "student", "publication", "team", "inkers"
}

# --- UTILITY FUNCTIONS ---

def log_debug(message):
    with open(DEBUG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {message}\n")

def get_last_scrape_time():
    if os.path.exists(LAST_SCRAPE_FILE):
        with open(LAST_SCRAPE_FILE, 'r') as f:
            return f.read().strip()
    return None

def save_last_scrape_time(timestamp):
    with open(LAST_SCRAPE_FILE, 'w') as f:
        f.write(timestamp)

def normalize_and_strip(text):
    if not text: return ""
    text = unicodedata.normalize('NFKC', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    return ' '.join(text.split()).strip()

def load_existing_lookup():
    lookup_file = 'extracted_inkers_lookup.txt'
    names = set()
    if os.path.exists(lookup_file):
        with open(lookup_file, 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line:
                    names.add(line.split('=')[0].strip())
    return names

EXISTING_LOOKUP = load_existing_lookup()
NEW_INKERS_FOUND = set()

def generate_slug(text, registry):
    """Restored slug generation function"""
    base = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or "post"
    if base not in registry:
        registry[base] = 0
        return base
    registry[base] += 1
    return f"{base}-{registry[base]}"

def clean_name_string(text):
    if ':' in text: text = text.split(':')[-1]
    text = re.sub(r'(?i).*?\bby\b', '', text)
    role_pattern = r'\b(' + '|'.join([f"{r}\w*" for r in SPECIFIC_ROLES]) + r')\b'
    text = re.sub(role_pattern, '', text, flags=re.IGNORECASE)
    text = INKER_RE.sub('', text)
    text = re.sub(r'UMIHS', '', text, flags=re.IGNORECASE).strip('-').strip()
    if ',' in text:
        parts = [p.strip() for p in text.split(',')]
        if len(parts) == 2: text = f"{parts[1]} {parts[0]}"
    return normalize_and_strip(text)

def is_valid_inker(name, original_line):
    if not name or len(name) < 3: return False
    words = name.split()
    if any(word.lower() in INKER_BLACKLIST for word in words): return False
    return len(words) <= 6 and bool(re.search(r'[a-zA-Z]', name))

def process_body_and_inkers(text):
    if not text: return "", []
    lines = text.split('\n')
    final_names, body_lines = [], []
    in_production_block = False

    for line in lines:
        raw_line = line.strip()
        if not raw_line:
            if not in_production_block: body_lines.append(line)
            continue
        norm = normalize_and_strip(raw_line)
        if INKER_RE.search(norm):
            in_production_block = True
            continue
        if in_production_block:
            if '#' not in norm and len(norm) < 60:
                for part in re.split(r'[&/]', norm):
                    cleaned = clean_name_string(part)
                    if is_valid_inker(cleaned, norm): final_names.append(cleaned)
            continue
        if CREDIT_RE.search(norm) and len(norm) < 75:
            cleaned = clean_name_string(norm)
            if is_valid_inker(cleaned, norm):
                final_names.append(cleaned)
                continue
        body_lines.append(line)

    unique_names = list(dict.fromkeys(final_names))
    for name in unique_names:
        if name not in EXISTING_LOOKUP: NEW_INKERS_FOUND.add(name)
    return '\n'.join(body_lines).strip(), unique_names

# --- DOWNLOADER ENGINE ---

def download_single_file(url, slug, index, media_type):
    ext = "mp4" if "video" in media_type.lower() else "jpg"
    filename = f"{slug}_{index}.{ext}"
    path = MEDIA_FOLDER / filename
    try:
        r = requests.get(url, stream=True, timeout=20)
        if r.status_code == 200:
            with path.open('wb') as f:
                for chunk in r.iter_content(32768): 
                    f.write(chunk)
            return {
                "type": "video" if "video" in media_type.lower() else "photo",
                "url": url,
                "localPath": str(path)
            }
    except Exception as e:
        log_debug(f"Failed Download: {url} - {e}")
    return None

def clean_title(text):
    if not text: return "Untitled Post", False
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[^a-zA-Z0-9\s.!?\':(),\-|]', '', text)
    text = ' '.join(text.split())
    trunc = False
    if len(text) > 70:
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
        if len(parts) > 1 and len(parts[0]) <= 90:
            text = parts[0].strip()
        else:
            text = text[:72].strip() + "..."
        trunc = True
    return text, trunc

def to_portable_text(text):
    return [{"_type": "block", "_key": str(uuid.uuid4())[:12], "style": "normal", "markDefs": [], "children": [{"_type": "span", "_key": str(uuid.uuid4())[:12], "text": p.strip(), "marks": []}]} for p in text.split('\n') if p.strip()]

def get_with_retry(url, params=None):
    for i in range(5):
        r = requests.get(url, params=params); d = r.json()
        if 'error' in d and d['error'].get('code') in [4, 17, 32, 613]:
            time.sleep((2 ** i) + 5); continue
        return d
    return {}

# --- MAIN LOOP ---

def scrape_to_json(output_file='fb_posts.json', max_posts=5000):
    print("🚀 Initializing High-Speed Scraper...")
    print("1: Everything | 2: Since Last Run")
    choice = input("Choice: ")

    last_time = get_last_scrape_time() if choice == "2" else None
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    params = {'fields': 'created_time,message,id,attachments{media,type,subattachments{media,type}}','access_token': PAGE_TOKEN,'limit': 50}
    
    all_records, slug_registry = [], {}
    newest_ts = None
    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    try:
        while url and len(all_records) < max_posts:
            data = get_with_retry(url, params)
            posts = data.get('data', [])
            if not posts: break
            
            for post in posts:
                pt = post.get('created_time')
                if not newest_ts: newest_ts = pt
                if last_time and pt <= last_time:
                    url = None; break

                raw_msg = post.get('message', '')
                if not raw_msg: continue
                
                title, is_trunc = clean_title(raw_msg.split('\n', 1)[0])
                slug = generate_slug(title, slug_registry)
                
                body_raw = raw_msg if is_trunc else (raw_msg.split('\n', 1)[1] if '\n' in raw_msg else "")
                body_clean, inkers = process_body_and_inkers(body_raw)

                record = {
                    "publishedAt": pt, "title": title, "fbLink": f"https://facebook.com/{post.get('id')}",
                    "linkName": {"_type": "slug", "current": slug}, "body": to_portable_text(body_clean),
                    "inkersOnDuty": inkers, "media": [], "type": "newsandannouncements", "_type": "article"
                }

                media_queue = []
                attachments = post.get('attachments', {}).get('data', [])
                for att in attachments:
                    items = att.get('subattachments', {}).get('data', [att])
                    for item in items:
                        m_data = item.get('media', {})
                        m_url = m_data.get('source') or m_data.get('image', {}).get('src')
                        if m_url: media_queue.append((m_url, item.get('type', 'photo')))

                if MAX_MEDIA_PER_POST: media_queue = media_queue[:MAX_MEDIA_PER_POST]

                futures = [executor.submit(download_single_file, m[0], slug, i, m[1]) for i, m in enumerate(media_queue)]
                for fut in as_completed(futures):
                    res = fut.result()
                    if res: record["media"].append(res)

                all_records.append(record)
                print(f"📦 [{len(all_records)}] {slug} | Media: {len(record['media'])}")
            
            url = data.get('paging', {}).get('next', None) if url else None
            
    except KeyboardInterrupt:
        print("\nStopping... Saving progress...")
    finally:
        print("⏳ Finalizing background tasks...")
        executor.shutdown(wait=True)

    if all_records:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_records, f, indent=4, ensure_ascii=False)
        if newest_ts: save_last_scrape_time(newest_ts)
        
    if NEW_INKERS_FOUND:
        with open('extracted_inkers.txt', 'w', encoding='utf-8') as f:
            for n in sorted(NEW_INKERS_FOUND): f.write(f"{n}={n}\n")
            
    print(f"✨ Success. {len(all_records)} posts saved.")

if __name__ == "__main__":
    scrape_to_json()