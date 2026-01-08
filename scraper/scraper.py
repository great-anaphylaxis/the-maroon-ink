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

# SCRAPE MODES: "MAX_POSTS" or "SINCE_LAST"
SCRAPE_MODE = "SINCE_LAST" 

# Capture up to 1000 items per post (for massive galleries)
MAX_MEDIA_PER_POST = 1000 
MAX_WORKERS = 15 

MEDIA_FOLDER = Path('media')
MEDIA_FOLDER.mkdir(exist_ok=True)
LAST_SCRAPE_FILE = "last_scrape.txt"
DEBUG_FILE = "extraction_debug.txt"

# --- REGEX PATTERNS & CONSTANTS ---
SPECIFIC_ROLES = ["illustrat", "cartoon", "graphic", "photo", "photos", "writ", "layout", "art", "contribut", "report"]
CREDIT_RE = re.compile(
    r'^(?:by|By)\s*:?|' + 
    r'|'.join([rf'^{role}\w*\s+by\s*:?' for role in SPECIFIC_ROLES]) + 
    r'|'.join([rf'\b{role}\w*\s+by\s*:' for role in SPECIFIC_ROLES]), 
    re.IGNORECASE
)
INKER_KEYWORDS = ["journalists on duty", "jounalist on duty", "inker on duty", "inkers on duty", "production team"]
INKER_RE = re.compile(r'|'.join([rf'\b{re.escape(kw)}\s*:?' for kw in INKER_KEYWORDS]), re.IGNORECASE)
INKER_BLACKLIST = {"the", "school", "page", "news", "event", "uimhs", "campus", "editorial", "official", "student", "publication", "team", "inkers"}

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

def download_single_file(url, slug, index, media_type, thumb_url=None):
    is_video = "video" in media_type.lower()
    ext = "mp4" if is_video else "jpg"
    filename = f"{slug}_{index}.{ext}"
    path = MEDIA_FOLDER / filename
    
    result = {
        "type": "video" if is_video else "photo",
        "url": url,
        "localPath": str(path),
        "thumbnail": None
    }

    try:
        r = requests.get(url, stream=True, timeout=20)
        if r.status_code == 200:
            with path.open('wb') as f:
                for chunk in r.iter_content(32768):
                    f.write(chunk)
            
        if is_video and thumb_url:
            thumb_filename = f"{slug}_{index}_thumb.jpg"
            thumb_path = MEDIA_FOLDER / thumb_filename
            tr = requests.get(thumb_url, stream=True, timeout=15)
            if tr.status_code == 200:
                with thumb_path.open('wb') as f:
                    for chunk in tr.iter_content(32768):
                        f.write(chunk)
                result["thumbnail"] = str(thumb_path)
                result["thumbnailUrl"] = thumb_url
        return result
    except Exception as e:
        log_debug(f"Failed Download: {url} - {e}")
    return None

# --- MEDIA EXTRACTION LOGIC ---

def get_thumbnail_from_item(item):
    """Aggressively finds a video thumbnail URL."""
    # Priority 1: High-res thumbnails array
    thumbs = item.get('thumbnails', {}).get('data', [])
    if thumbs:
        return thumbs[0].get('uri') or thumbs[0].get('src')
    
    # Priority 2: Full picture field (standard preview)
    if item.get('full_picture'):
        return item.get('full_picture')
    
    # Priority 3: Media object image
    media_img = item.get('media', {}).get('image', {})
    if media_img.get('src'):
        return media_img.get('src')
    
    return None

def get_url_from_item(item):
    media = item.get('media', {})
    source = media.get('source') # Video
    if source:
        return source
    img = media.get('image', {}) # Photo
    return img.get('src')

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
        try:
            r = requests.get(url, params=params)
            d = r.json()
            if 'error' in d and d['error'].get('code') in [4, 17, 32, 613]:
                time.sleep((2 ** i) + 5)
                continue
            return d
        except:
            time.sleep(2)
    return {}

# --- MAIN ENGINE ---

def scrape_to_json(output_file='fb_posts.json', max_posts=490):
    print(f"🚀 Initializing Scraper (Mode: {SCRAPE_MODE})...")
    last_time = get_last_scrape_time() if SCRAPE_MODE == "SINCE_LAST" else None
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    
    # Fields optimized for gallery depth and video metadata
    params = {
        'fields': 'created_time,message,id,attachments{media,type,full_picture,thumbnails,subattachments.limit(100){media,type,full_picture,thumbnails}}',
        'access_token': PAGE_TOKEN,
        'limit': 20
    }
    
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
                    # 1. Gallery Processing
                    if 'subattachments' in att:
                        current_sub_node = att['subattachments']
                        while True:
                            sub_data = current_sub_node.get('data', [])
                            for sub_item in sub_data:
                                if len(media_queue) >= MAX_MEDIA_PER_POST: break
                                m_url = get_url_from_item(sub_item)
                                if m_url:
                                    m_type = sub_item.get('type', 'photo')
                                    t_url = get_thumbnail_from_item(sub_item) if "video" in m_type else None
                                    media_queue.append((m_url, m_type, t_url))
                            
                            next_sub_page = current_sub_node.get('paging', {}).get('next')
                            if next_sub_page and len(media_queue) < MAX_MEDIA_PER_POST:
                                current_sub_node = get_with_retry(next_sub_page)
                            else: break
                    # 2. Single Item Processing
                    else:
                        m_url = get_url_from_item(att)
                        if m_url:
                            m_type = att.get('type', 'photo')
                            t_url = get_thumbnail_from_item(att) if "video" in m_type else None
                            media_queue.append((m_url, m_type, t_url))

                # Multi-threaded download
                futures = [executor.submit(download_single_file, m[0], slug, i, m[1], m[2]) for i, m in enumerate(media_queue)]
                for fut in as_completed(futures):
                    res = fut.result()
                    if res: record["media"].append(res)

                all_records.append(record)
                print(f"📦 [{len(all_records)}] {slug} | Media: {len(media_queue)}")
            
            url = data.get('paging', {}).get('next', None) if url else None
            params = None # Parameters are included in the 'next' URL
            
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        executor.shutdown(wait=True)

    if all_records:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_records, f, indent=4, ensure_ascii=False)
        if newest_ts: save_last_scrape_time(newest_ts)
        
    if NEW_INKERS_FOUND:
        with open('extracted_inkers.txt', 'w', encoding='utf-8') as f:
            for n in sorted(NEW_INKERS_FOUND): f.write(f"{n}={n}\n")
            
    print(f"✨ Scrape complete. {len(all_records)} posts processed.")

if __name__ == "__main__":
    scrape_to_json()