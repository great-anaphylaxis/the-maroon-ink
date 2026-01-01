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

# Ensure the images directory exists
IMAGE_FOLDER = 'images'
if not os.path.exists(IMAGE_FOLDER):
    os.makedirs(IMAGE_FOLDER)

def download_image(url, slug):
    """
    Downloads an image from a URL and saves it to the /images folder.
    Returns the local path if successful, otherwise None.
    """
    try:
        file_path = os.path.join(IMAGE_FOLDER, f"{slug}.jpg")
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return file_path
    except Exception as e:
        print(f"      ❌ Failed to download image for {slug}: {e}")
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
    if not text: return "Untitled Post"
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[^a-zA-Z0-9\s.,!|?:\']', '', text)
    text = ' '.join(text.split())
    if len(text) > 70:
        if len(text) > 80:
            sentences = re.split(r'[.?!|]', text)
            if sentences and sentences[0]: text = sentences[0].strip()
        if len(text) > 70: text = text[:67].strip() + "..."
    return text or "Untitled Post"

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
            error_code = data['error'].get('code')
            if error_code in [4, 17, 32, 613]:
                time.sleep((2 ** i) + 5)
                continue
        return data
    return {"error": {"message": "Max retries exceeded"}}

def get_images_from_any_id(target_id):
    images = []
    url = f"https://graph.facebook.com/v21.0/{target_id}/attachments"
    params = {'fields': 'subattachments.limit(100){media}', 'access_token': PAGE_TOKEN}
    data = get_with_retry(url, params)
    if 'data' in data:
        for entry in data['data']:
            subs = entry.get('subattachments', {}).get('data', [])
            items = subs if subs else [entry]
            for item in items:
                img = item.get('media', {}).get('image', {}).get('src')
                if img: images.append(img)
    return images

def scrape_to_json(output_file='fb_posts.json', max_posts=50, infinite=False):
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    params = {
        'fields': 'created_time,message,id,attachments{target,type,media,subattachments{media}}',
        'access_token': PAGE_TOKEN,
        'limit': 25 
    }
    
    all_records = []
    slug_registry = {} 
    print(f"🚀 Scraping Page: {PAGE_ID}...")

    try:
        while url:
            if not infinite and len(all_records) >= max_posts: break
            data = get_with_retry(url, params)
            if 'error' in data: break
                
            posts = data.get('data', [])
            if not posts: break

            for post in posts:
                if not infinite and len(all_records) >= max_posts: break
                
                post_id = post.get('id')
                raw_message = post.get('message', '')
                
                final_images = []
                attachments = post.get('attachments', {}).get('data', [])
                if attachments:
                    main_attach = attachments[0]
                    subs = main_attach.get('subattachments', {}).get('data', [])
                    if subs:
                        for s in subs:
                            img = s.get('media', {}).get('image', {}).get('src')
                            if img: final_images.append(img)
                    if not final_images:
                        img = main_attach.get('media', {}).get('image', {}).get('src')
                        if img: final_images.append(img)
                    if not final_images or main_attach.get('type') == 'shared_story':
                        target_id = main_attach.get('target', {}).get('id')
                        if target_id and target_id != post_id:
                            final_images.extend(get_images_from_any_id(target_id))

                final_images = list(dict.fromkeys(final_images))
                
                first_line = raw_message.split('\n')[0] if raw_message else ""
                title_cleaned = clean_title(first_line)
                unique_slug = generate_slug(title_cleaned, slug_registry)

                record = {
                    "publishedAt": post.get('created_time'),
                    "title": title_cleaned,
                    "linkName": {"_type": "slug", "current": unique_slug},
                    "body": to_portable_text(raw_message),
                    "type": "newsandannouncements",
                    "_type": "article"
                }

                # --- RENAMED TO 'image' WITH SANITY STRUCTURE ---
                if final_images:
                    local_path = download_image(final_images[0], unique_slug)
                    if local_path:
                        record["image"] = {
                            "_type": "image",
                            "asset": {
                                "_type": "reference",
                                "_ref": "" # Blank as requested
                            },
                            "localPath": local_path # Optional: keeping local track
                        }
                        print(f"✅ [{len(all_records)}] 🖼️ {unique_slug} (Downloaded)")
                    else:
                        print(f"✅ [{len(all_records)}] 🖼️ {unique_slug} (Download Failed)")
                else:
                    print(f"✅ [{len(all_records)}] 📝 {unique_slug}")

                all_records.append(record)

            url = data.get('paging', {}).get('next', None)
            params = {} 

    except KeyboardInterrupt:
        print("\n🛑 Saving progress...")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=4, ensure_ascii=False)

    print(f"✨ Done! Check the '/{IMAGE_FOLDER}' folder and '{output_file}'.")

if __name__ == "__main__":
    scrape_to_json(max_posts=500, infinite=True)