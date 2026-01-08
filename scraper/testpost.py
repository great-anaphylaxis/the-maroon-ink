import os
import requests
from dotenv import load_dotenv

load_dotenv()

def extract_facebook_page_media():
    token = os.getenv("FB_PAGE_ACCESS_TOKEN")
    page_id = os.getenv("PAGE_ID")
    post_id = os.getenv("FB_POST_ID")

    if not all([token, page_id, post_id]):
        print("Missing .env variables.")
        return

    global_id = f"{page_id}_{post_id}"
    
    # We request 'media' which contains both 'image' and 'source' for videos
    url = f"https://graph.facebook.com/v19.0/{global_id}"
    params = {
        'fields': 'attachments{media,type,subattachments.limit(100){media,type}}',
        'access_token': token
    }

    all_links = []
    print(f"Requesting media for: {global_id}...")

    try:
        response = requests.get(url, params=params)
        data = response.json()

        if 'error' in data:
            print(f"API Error: {data['error'].get('message')}")
            return

        attachments_node = data.get('attachments', {}).get('data', [])
        
        for attachment in attachments_node:
            # 1. Handle Multi-item posts (Subattachments)
            if 'subattachments' in attachment:
                sub_data = attachment['subattachments'].get('data', [])
                for sub_item in sub_data:
                    all_links.append(get_url(sub_item))
            # 2. Handle Single-item posts
            else:
                all_links.append(get_url(attachment))

        # Filter out None values and save
        all_links = [link for link in all_links if link]
        save_to_file(all_links, f"media_{global_id}.txt")

    except Exception as e:
        print(f"Script Error: {e}")

def get_url(item):
    """
    Based on your JSON structure:
    Video URL is in item['media']['source']
    Photo URL is in item['media']['image']['src']
    """
    media = item.get('media', {})
    
    # Priority 1: Direct Video Source
    video_source = media.get('source')
    if video_source:
        return video_source
    
    # Priority 2: High-res Image Source
    image_obj = media.get('image', {})
    return image_obj.get('src')

def save_to_file(links, filename):
    if not links:
        print("No URLs found.")
        return
    with open(filename, "w") as f:
        for link in links:
            f.write(f"{link}\n")
    print(f"Success! {len(links)} links saved to {filename}")

if __name__ == "__main__":
    extract_facebook_page_media()