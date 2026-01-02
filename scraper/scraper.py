import os
import requests
import json
import time
import uuid
import re
import unicodedata
from dotenv import load_dotenv

load_dotenv()

PAGE_TOKEN = os.getenv('FB_PAGE_ACCESS_TOKEN') 
PAGE_ID = os.getenv('PAGE_ID') 

IMAGE_FOLDER = 'images'
if not os.path.exists(IMAGE_FOLDER):
    os.makedirs(IMAGE_FOLDER)

def classify_post_type(title):
    """
    Classifies the article type based on keywords in the title.
    """
    title_lower = title.lower()
    
    # 1. 'sports' or 'sport' always takes precedence, even if 'news' is present
    if "sports" in title_lower or "sport" in title_lower:
        return "sports"
    
    # 2. If 'news' is present, we ignore other category checks
    if "news" in title_lower:
        return "newsandannouncements"
    
    # 3. Specific category checks
    if "opinion" in title_lower:
        return "opinion"
    if "literature" in title_lower:
        return "literature"
    if "feature" in title_lower:
        return "feature"
        
    # Default fallback
    return "newsandannouncements"

def clean_name_string(text):
    """
    Applies the specific formatting rules to an individual name line.
    """
    # 1. Convert styled characters to normal characters (Normalization)
    text = unicodedata.normalize('NFKD', text)
    
    # 2. Remove "UMIHS" (case-insensitive)
    text = re.sub(r'UMIHS', '', text, flags=re.IGNORECASE)
    
    # 3. Handle colons (Remove everything before and including the colon)
    if ':' in text:
        text = text.split(':')[-1]
        
    # 4. Handle standalone "by" (Remove everything before and including the word "by")
    text = re.sub(r'.*?\bby\b', '', text, flags=re.IGNORECASE)
    
    # Clean up whitespace after prefix removal
    text = text.strip()
    
    # 5. Handle Comma Swapping (Doe, John Matthew -> John Matthew Doe)
    if ',' in text:
        parts = [p.strip() for p in text.split(',')]
        if len(parts) == 2:
            # Swap: parts[1] is first name, parts[0] is last name
            text = f"{parts[1]} {parts[0]}"

    return text.strip()

def process_body_and_inkers(text):
    """
    Splits the body from the signature, processes name formatting rules,
    and returns (cleaned_body_string, list_of_formatted_names).
    """
    if not text:
        return "", []

    normalized_text = unicodedata.normalize('NFKD', text)
    
    keywords = [
        "journalists on duty", 
        "jounalist on duty", 
        "inker on duty", 
        "inkers on duty",
        "production team"
    ]
    pattern = re.compile(r'|'.join(map(re.escape, keywords)), re.IGNORECASE)

    matches = list(pattern.finditer(normalized_text))
    
    if matches:
        last_match = matches[-1]
        split_point = last_match.start()
        
        body_part = text[:split_point].strip()
        signature_part = text[split_point:].strip()
        
        raw_lines = signature_part.split('\n')
        final_names = []
        
        for line in raw_lines:
            line_strip = line.strip()
            if not line_strip or '#' in line_strip:
                continue
            
            if pattern.search(unicodedata.normalize('NFKD', line_strip)):
                continue
            
            # Handle ampersands (&) - Split line into multiple names
            if '&' in line_strip:
                sub_parts = line_strip.split('&')
            else:
                sub_parts = [line_strip]

            for part in sub_parts:
                cleaned = clean_name_string(part)
                if cleaned:
                    final_names.append(cleaned)
            
        return body_part, final_names
    
    return text, []

def download_image(url, slug):
    try:
        file_path = os.path.join(IMAGE_FOLDER, f"{slug}.jpg")
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return file_path
    except Exception as e:
        print(f"      ❌ Image Error for {slug}: {e}")
    return None

def generate_slug(text, registry):
    base_slug = text.lower()
    base_slug = re.sub(r'[^a-z0-9]+', '-', base_slug)
    base_slug = base_slug.strip('-')
    if not base_slug: base_slug = "post"
    if base_slug not in registry:
        registry[base_slug] = 0
        return base_slug
    else:
        registry[base_slug] += 1
        return f"{base_slug}-{registry[base_slug]}"

def clean_title(text):
    if not text: return "Untitled Post", False
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[^a-zA-Z0-9\s.!?\']', '', text)
    text = ' '.join(text.split())
    is_truncated = False
    if len(text) > 70:
        is_truncated = True
        if len(text) > 80:
            parts = re.split(r'(?<=[.!?])', text)
            if parts and parts[0]: text = parts[0].strip()
        if len(text) > 70: text = text[:67].strip() + "..."
    return (text or "Untitled Post"), is_truncated

def to_portable_text(text):
    if not text: return []
    blocks = []
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    for para in paragraphs:
        blocks.append({
            "_type": "block",
            "_key": str(uuid.uuid4())[:12],
            "style": "normal",
            "markDefs": [],
            "children": [{"_type": "span", "_key": str(uuid.uuid4())[:12], "text": para, "marks": []}]
        })
    return blocks

def get_with_retry(url, params=None, max_retries=5):
    for i in range(max_retries):
        response = requests.get(url, params=params)
        data = response.json()
        if 'error' in data:
            if data['error'].get('code') in [4, 17, 32, 613]:
                time.sleep((2 ** i) + 5)
                continue
        return data
    return {"error": {"message": "Max retries exceeded"}}

def scrape_to_json(output_file='fb_posts.json', max_posts=500):
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    params = {
        'fields': 'created_time,message,id,attachments{target,type,media,subattachments{media}}',
        'access_token': PAGE_TOKEN,
        'limit': 25 
    }
    
    all_records = []
    slug_registry = {} 
    print(f"🚀 Starting Scrape for {PAGE_ID}...")

    try:
        while url and len(all_records) < max_posts:
            data = get_with_retry(url, params)
            posts = data.get('data', [])
            if not posts: break

            for post in posts:
                if len(all_records) >= max_posts: break
                
                raw_message = post.get('message', '')
                lines = raw_message.split('\n', 1)
                first_line = lines[0] if len(lines) > 0 else ""
                remaining_body = lines[1] if len(lines) > 1 else ""

                title_cleaned, was_truncated = clean_title(first_line)
                unique_slug = generate_slug(title_cleaned, slug_registry)
                
                # Dynamic classification based on title keywords
                post_type = classify_post_type(title_cleaned)
                
                initial_body = remaining_body if not was_truncated else raw_message
                final_body_content, inkers_list = process_body_and_inkers(initial_body)

                record = {
                    "publishedAt": post.get('created_time'),
                    "title": title_cleaned,
                    "linkName": {"_type": "slug", "current": unique_slug},
                    "body": to_portable_text(final_body_content),
                    "inkersOnDuty": inkers_list,
                    "type": post_type,
                    "_type": "article"
                }

                # Image Logic
                attachments = post.get('attachments', {}).get('data', [])
                if attachments:
                    img_url = attachments[0].get('media', {}).get('image', {}).get('src')
                    if img_url:
                        path = download_image(img_url, unique_slug)
                        if path:
                            record["image"] = {
                                "_type": "image",
                                "asset": { "_type": "reference", "_ref": "" },
                                "localPath": path
                            }

                all_records.append(record)
                print(f"✅ [{len(all_records)}] {unique_slug} | Type: {post_type} | Inkers: {len(inkers_list)}")

            url = data.get('paging', {}).get('next', None)
            params = {} 

    except KeyboardInterrupt:
        print("\n🛑 Stopping...")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=4, ensure_ascii=False)
    print(f"✨ File saved as {output_file}")

if __name__ == "__main__":
    scrape_to_json()