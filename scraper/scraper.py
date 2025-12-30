import os
import requests
import json
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

PAGE_TOKEN = os.getenv('FB_PAGE_ACCESS_TOKEN') 
PAGE_ID = os.getenv('PAGE_ID') # Recommended to keep ID in .env too

def scrape_to_ndjson(max_posts=100, output_file='fb_posts.ndjson'):
    url = f"https://graph.facebook.com/v21.0/{PAGE_ID}/posts"
    
    params = {
        'fields': 'created_time,message,attachments{type,media,url}',
        'access_token': PAGE_TOKEN,
        'limit': 50
    }
    
    count = 0
    print(f"Starting scrape. Target: {max_posts} posts. Saving to {output_file}")

    # Open file in 'append' mode to ensure safety
    with open(output_file, 'a', encoding='utf-8') as f:
        while url and count < max_posts:
            response = requests.get(url, params=params)
            data = response.json()
            
            if 'error' in data:
                print(f"API Error: {data['error']['message']}")
                break
                
            posts = data.get('data', [])
            if not posts:
                break

            for post in posts:
                if count >= max_posts:
                    break

                # Process Attachments
                attachment_info = []
                attachments = post.get('attachments', {}).get('data', [])
                for attach in attachments:
                    media_url = attach.get('media', {}).get('image', {}).get('src', '')
                    attachment_info.append({
                        'type': attach.get('type'),
                        'media_url': media_url, # Remember: these links are temporary
                        'link': attach.get('url')
                    })

                # Create the record
                record = {
                    'date': post.get('created_time'),
                    'content': post.get('message', ''),
                    'attachments': attachment_info
                }

                # Write as a single line in NDJSON format
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
                count += 1
            
            print(f"Progress: {count} posts written...")
            
            # Pagination
            url = data.get('paging', {}).get('next')
            params = {} 

    print(f"Done! {count} posts saved.")

# Execution
scrape_to_ndjson(max_posts=100)