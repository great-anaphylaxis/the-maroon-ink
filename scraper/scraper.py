import os
import requests
import json
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

PAGE_TOKEN = os.getenv('FB_PAGE_ACCESS_TOKEN') 
PAGE_ID = os.getenv('PAGE_ID')

def scrape_to_json(max_posts=100):
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    
    params = {
        'fields': 'created_time,message,attachments{type,media,url}',
        'access_token': PAGE_TOKEN,
        'limit': 50
    }
    
    all_posts = []
    
    print(f"Starting scrape. Target: {max_posts} posts.")

    while url:
        response = requests.get(url, params=params)
        data = response.json()
        
        if 'error' in data:
            print(f"API Error: {data['error']['message']}")
            break
            
        posts = data.get('data', [])
        for post in posts:
            if len(all_posts) >= max_posts:
                break

            # Process Attachments
            attachment_info = []
            attachments = post.get('attachments', {}).get('data', [])
            for attach in attachments:
                media_url = attach.get('media', {}).get('image', {}).get('src', '')
                attachment_info.append({
                    'type': attach.get('type'),
                    'media_url': media_url,
                    'link': attach.get('url')
                })

            all_posts.append({
                'date': post.get('created_time'),
                'content': post.get('message', ''),
                'attachments': attachment_info
            })
        
        print(f"Collected {len(all_posts)} posts...")
        
        # Hard stop check for the while loop
        if len(all_posts) >= max_posts:
            break

        url = data.get('paging', {}).get('next')
        params = {} 

    # Save to JSON file
    with open('fb_posts.json', 'w', encoding='utf-8') as f:
        # indent=4 makes the JSON readable (pretty-print)
        # ensure_ascii=False handles non-English characters correctly
        json.dump(all_posts, f, indent=4, ensure_ascii=False)
    
    return all_posts

# Execution
posts_data = scrape_to_json(max_posts=50)
print(f"Done! Successfully saved {len(posts_data)} posts to fb_posts.json")