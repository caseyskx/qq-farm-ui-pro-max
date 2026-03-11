import os
import re
import ssl
import urllib.request
import urllib.parse
from html.parser import HTMLParser

BASE_URL = "https://jsq.gptvip.chat"
PAGES = [
    "/",
    "/calculator",
    "/levels",
    "/plants",
    "/lands",
    "/items/05"
]

class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.resources = set()
        self.pages = set()

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "img" and "src" in attrs_dict:
            if attrs_dict["src"].startswith("/"):
                self.resources.add(attrs_dict["src"])
        elif tag == "script" and "src" in attrs_dict:
            if attrs_dict["src"].startswith("/"):
                self.resources.add(attrs_dict["src"])
        elif tag == "link" and "href" in attrs_dict:
            if attrs_dict["rel"] in ["stylesheet", "icon", "preload"] or attrs_dict["href"].endswith(".css") or attrs_dict["href"].endswith(".ico"):
                if attrs_dict["href"].startswith("/"):
                    self.resources.add(attrs_dict["href"])
        elif tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            if href.startswith("/") and not href.startswith("//") and href not in PAGES and "." not in href.split("/")[-1]:
                self.pages.add(href)

def download_file(path, is_html=False):
    url = BASE_URL + path
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, context=ctx)
        data = response.read()
        return data.decode('utf-8') if is_html else data
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return None

def save_file(path, data, is_html=False):
    if not data:
        return
    
    # Handle the fact that root is index.html
    if path == "/":
        local_path = "index.html"
    else:
        # Strip leading slash
        local_path = path.lstrip("/")
        if is_html and not local_path.endswith(".html"):
            local_path += ".html"
            
    # Ensure dir exists
    dir_name = os.path.dirname(local_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
        
    mode = 'w' if is_html else 'wb'
    with open(local_path, mode, encoding='utf-8' if is_html else None) as f:
        f.write(data)

def process_html(html, current_path):
    # Calculate relative depth to root for rewriting absolute paths to relative
    depth = current_path.count('/') - 1 if current_path != "/" else 0
    prefix = "../" * depth if depth > 0 else "./"
    
    # Replace href="/..." and src="/..." with local relative paths
    def replacer(match):
        attr = match.group(1)
        path = match.group(2)
        if path.startswith("//") or path.startswith("http"):
            return match.group(0)
        
        if path == "/":
            path = "/index.html"
        elif ("." not in path.split("/")[-1]) and (path in PAGES or path.startswith("/items/")):
            path = path + ".html"
            
        return f'{attr}="{prefix}{path.lstrip("/")}"'
        
    # Replace absolute internal paths to relative
    html = re.sub(r'(href|src)="(/[^"]*)"', replacer, html)
    return html

def main():
    pages_to_process = list(PAGES)
    processed_pages = set()
    all_resources = set()
    
    # Process all pages
    while pages_to_process:
        page_path = pages_to_process.pop(0)
        if page_path in processed_pages:
            continue
            
        print(f"Downloading HTML: {page_path}")
        html = download_file(page_path, is_html=True)
        if not html:
            continue
            
        processed_pages.add(page_path)
        
        # Parse resources
        parser = ResourceParser()
        parser.feed(html)
        
        # Add new pages to process (like other /items/...)
        for new_p in parser.pages:
            if new_p not in processed_pages and new_p not in pages_to_process and not new_p.startswith('/javascript:'):
                pages_to_process.append(new_p)
                PAGES.append(new_p)
                
        # Add resources
        all_resources.update(parser.resources)
        
        # Rewrite HTML paths and save
        rewritten_html = process_html(html, page_path)
        save_file(page_path, rewritten_html, is_html=True)
        
    print(f"Discovered {len(all_resources)} static resources.")
    
    # Process all resources
    for res in all_resources:
        print(f"Downloading resource: {res}")
        data = download_file(res, is_html=False)
        save_file(res, data, is_html=False)
        
    print("Done! Site replicated.")

if __name__ == "__main__":
    main()
