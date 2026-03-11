import os
import json
import urllib.request
import time

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

BASE_URL = "https://jsq.gptvip.chat"

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def download_time_crops():
    print("Fetching time_crops...")
    data = fetch_json(f"{BASE_URL}/api/time_crops")
    if data:
        with open(os.path.join(DATA_DIR, 'crops.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Saved crops.json")

def download_lands_data():
    print("Fetching lands data...")
    lands_data = {}
    for level in range(1, 101):
        success = False
        while not success:
            data = fetch_json(f"{BASE_URL}/api/lands_for_level?level={level}")
            if data:
                lands_data[str(level)] = data
                print(f"Level {level} done.")
                success = True
                time.sleep(0.3)
            else:
                print(f"Level {level} failed, retrying in 2 seconds...")
                time.sleep(2)
    
    with open(os.path.join(DATA_DIR, 'lands.json'), 'w', encoding='utf-8') as f:
        json.dump(lands_data, f, ensure_ascii=False, indent=2)
    print("Saved lands.json")

if __name__ == "__main__":
    download_lands_data()
    print("Data extraction complete.")
