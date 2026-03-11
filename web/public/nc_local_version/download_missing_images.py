import os
import re
import ssl
import urllib.request
import urllib.parse
import sys

BASE_URL = "https://jsq.gptvip.chat/"

def download_file(url, local_path):
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, context=ctx)
        data = response.read()
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, 'wb') as f:
            f.write(data)
        return True
    except Exception as e:
        # print(f"Failed {url}: {e}")
        return False

def main():
    html_files = [f for f in os.listdir('.') if f.endswith('.html')] + \
                 [os.path.join('items', f) for f in os.listdir('items') if f.endswith('.html')]
                 
    # Regex to find any string that looks like a .png or .gif or .jpg image file
    # This will catch everything in "img": "xxx.png" or "thumb": "yyy.png" etc.
    img_pattern = re.compile(r'([a-zA-Z0-9_\-\./\\]+\.(?:png|gif|jpg|jpeg|webp))', re.IGNORECASE)
    
    missing_images = set()
    found_images = set()
    
    for html_file in html_files:
        if not os.path.exists(html_file): continue
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # find all image string patterns
            matches = img_pattern.findall(content)
            for m in matches:
                # clean up the filename
                filename = m.split('/')[-1]
                found_images.add(filename)
                
    print(f"Discovered {len(found_images)} potential image names from code.")
    
    downloaded_count = 0
    for filename in found_images:
        local_path = os.path.join('images', filename)
        if not os.path.exists(local_path):
            uri = f"images/{filename}"
            url = urllib.parse.urljoin(BASE_URL, uri)
            
            # Sysout progress
            sys.stdout.write(f"\rDownloading missing: {filename} ... ")
            sys.stdout.flush()
            
            if download_file(url, local_path):
                downloaded_count += 1
            else:
                # Some matches might just be random strings ending in .png that don't exist on server
                pass
                
    print(f"\nSuccessfully downloaded {downloaded_count} new images.")

if __name__ == "__main__":
    main()
