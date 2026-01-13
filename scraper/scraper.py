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

# Capture settings
MAX_MEDIA_PER_POST = 1000 
MAX_WORKERS = 15 

MEDIA_FOLDER = Path('media')
MEDIA_FOLDER.mkdir(exist_ok=True)
LAST_SCRAPE_FILE = "last_scrape.txt"
DEBUG_FILE = "extraction_debug.txt"

# --- REGEX PATTERNS & CONSTANTS ---
SPECIFIC_ROLES = ["illustrat", "cartoon", "graphic", "photo", "photos", "writ", "layout", "art", "contribut", "report", "news report", "video edit", "scriptwrit", "oversight"]
CREDIT_RE = re.compile(
    r'^(?:by|By)\s*:?|' + 
    r'|'.join([rf'^{role}\w*\s+by\s*:?' for role in SPECIFIC_ROLES]) + 
    r'|'.join([rf'\b{role}\w*\s+by\s*:' for role in SPECIFIC_ROLES]), 
    re.IGNORECASE
)
INKER_KEYWORDS = ["journalists on duty", "jounalist on duty", "inker on duty", "inkers on duty", "production team", "ink contributors"]
INKER_RE = re.compile(r'|'.join([rf'\b{re.escape(kw)}\s*:?' for kw in INKER_KEYWORDS]), re.IGNORECASE)
INKER_BLACKLIST = {"the", "school", "page", "news", "event", "umihs", "campus", "editorial", "official", "student", "publication", "team", "inkers"}

# --- CLASSIFICATION LOGIC ---

def classify_post_type(title):
    """Classifies the article type based on keywords in the title."""
    title_lower = title.lower()
    if "sports" in title_lower or "sport" in title_lower:
        return "sports"
    if "news" in title_lower:
        return "newsandannouncements"
    if "opinion" in title_lower:
        return "opinion"
    if "literature" in title_lower:
        return "literature"
    if "feature" in title_lower:
        return "feature"
    return "newsandannouncements"

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
    # 1. First, NFKC to fix "fancy" Facebook fonts
    text = unicodedata.normalize('NFKC', text)
    
    # 2. Then, NFD to decompose characters. 
    # This turns "ñ" into "n" (char 110) + "combining tilde" (char 771)
    text = unicodedata.normalize('NFD', text)
    
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
    """Cleans credit lines while preserving non-English characters like ñ."""
    if ':' in text: text = text.split(':')[-1]
    text = re.sub(r'(?i).*?\bby\b', '', text)
    role_pattern = r'\b(' + '|'.join([f"{r}\w*" for r in SPECIFIC_ROLES]) + r')\b'
    text = re.sub(role_pattern, '', text, flags=re.IGNORECASE)
    text = INKER_RE.sub('', text)
    text = re.sub(r'UMIHS', '', text, flags=re.IGNORECASE)
    text = text.strip('-').strip()
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
                for chunk in r.iter_content(32768): f.write(chunk)
            
        if is_video and thumb_url:
            thumb_filename = f"{slug}_{index}_thumb.jpg"
            thumb_path = MEDIA_FOLDER / thumb_filename
            tr = requests.get(thumb_url, stream=True, timeout=15)
            if tr.status_code == 200:
                with thumb_path.open('wb') as f:
                    for chunk in tr.iter_content(32768): f.write(chunk)
                result["thumbnail"] = str(thumb_path)
        return result
    except Exception as e:
        log_debug(f"Failed Download: {url} - {e}")
    return None

# --- MEDIA EXTRACTION LOGIC ---

def get_thumbnail_from_item(item):
    thumbs = item.get('thumbnails', {}).get('data', [])
    if thumbs: return thumbs[0].get('uri') or thumbs[0].get('src')
    if item.get('full_picture'): return item.get('full_picture')
    return item.get('media', {}).get('image', {}).get('src')

def get_url_from_item(item):
    media = item.get('media', {})
    return media.get('source') or media.get('image', {}).get('src')

def clean_title(text):
    if not text: return "Untitled Post", False
    text = normalize_and_strip(text)
    text = re.sub(r'[^a-zA-Z0-9\s.!?\':(),\-|ñÑ]', '', text)
    trunc = False
    if len(text) > 70:
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
        text = parts[0].strip() if len(parts) > 1 and len(parts[0]) <= 90 else text[:72].strip() + "..."
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
    
    params = {
        'fields': 'created_time,message,id,attachments{media,type,full_picture,thumbnails,subattachments.limit(100){media,type,full_picture,thumbnails}}',
        'access_token': PAGE_TOKEN,
        'limit': 15
    }
    
    all_records, slug_registry = [], {}
    newest_ts = None
    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    try:
        while url and len(all_records) < max_posts:
            data = get_with_retry(url, params)
            posts = data.get('data', [])
            
            if not posts:
                print("🏁 No more posts found. Ending loop.")
                break
            
            for post in posts:
                pt = post.get('created_time')
                if not newest_ts: newest_ts = pt
                
                if last_time and pt <= last_time:
                    print(f"⏱️ Reached previously scraped content ({pt}). Stopping.")
                    url = None
                    break

                raw_msg = post.get('message', '')
                if not raw_msg: continue
                
                title, is_trunc = clean_title(raw_msg.split('\n', 1)[0])
                slug = generate_slug(title, slug_registry)
                body_raw = raw_msg if is_trunc else (raw_msg.split('\n', 1)[1] if '\n' in raw_msg else "")
                body_clean, inkers = process_body_and_inkers(body_raw)

                # --- CLASSIFY POST ---
                post_cat = classify_post_type(title)

                record = {
                    "publishedAt": pt, "title": title, "fbLink": f"https://facebook.com/{post.get('id')}",
                    "linkName": {"_type": "slug", "current": slug}, "body": to_portable_text(body_clean),
                    "inkersOnDuty": inkers, "media": [], "type": post_cat, "_type": "article"
                }

                media_queue = []
                attachments = post.get('attachments', {}).get('data', [])
                
                for att in attachments:
                    if 'subattachments' in att:
                        sub_node = att['subattachments']
                        while True:
                            for item in sub_node.get('data', []):
                                if len(media_queue) >= MAX_MEDIA_PER_POST: break
                                m_url = get_url_from_item(item)
                                if m_url:
                                    m_type = item.get('type', 'photo')
                                    t_url = get_thumbnail_from_item(item) if "video" in m_type else None
                                    media_queue.append((m_url, m_type, t_url))
                            
                            sub_next = sub_node.get('paging', {}).get('next')
                            if sub_next and len(media_queue) < MAX_MEDIA_PER_POST:
                                sub_node = get_with_retry(sub_next)
                            else: break
                    else:
                        m_url = get_url_from_item(att)
                        if m_url:
                            m_type = att.get('type', 'photo')
                            t_url = get_thumbnail_from_item(att) if "video" in m_type else None
                            media_queue.append((m_url, m_type, t_url))

                futures = [executor.submit(download_single_file, m[0], slug, i, m[1], m[2]) for i, m in enumerate(media_queue)]
                for fut in as_completed(futures):
                    res = fut.result()
                    if res: record["media"].append(res)

                all_records.append(record)
                print(f"📦 [{len(all_records)}] {slug} | Cat: {post_cat} | Media: {len(media_queue)}")
            
            # Pagination cursor handling
            url = data.get('paging', {}).get('next') if url else None
            params = None
            
    finally:
        executor.shutdown(wait=True)

    if all_records:
        with open(output_file, 'w', encoding='utf-8') as f:
            # ensure_ascii=False keeps the decomposed "n" + "tilde" 
            # as a readable character instead of \u00f1
            json.dump(all_records, f, indent=4, ensure_ascii=False)
        
        if newest_ts: 
            save_last_scrape_time(newest_ts)
            
    if NEW_INKERS_FOUND:
        with open('extracted_inkers.txt', 'w', encoding='utf-8') as f:
            for n in sorted(NEW_INKERS_FOUND): 
                f.write(f"{n}={n}\n")
            
    print(f"✨ Complete. Processed {len(all_records)} posts.")

if __name__ == "__main__":
    scrape_to_json()