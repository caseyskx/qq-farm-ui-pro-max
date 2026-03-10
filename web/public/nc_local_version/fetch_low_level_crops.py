"""
从原站 API 抓取 Lv1-15 的作物数据并合并到 crops.json
"""
import json
import urllib.request
import urllib.parse
import time
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CROPS_FILE = os.path.join(DATA_DIR, 'crops.json')
BASE_URL = "https://jsq.gptvip.chat/api/calculator"

def fetch_crops_for_level(level):
    """从原站 API 获取指定等级的作物列表"""
    params = {
        'level': level,
        'fert': 1,
        'ideal': 0,
        'smart': 0,
        'gold': 0,
        'black': 0,
        'red': 0,
        'normal': 6,
        's2fert': 0,
    }
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://jsq.gptvip.chat/',
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data

def extract_crop_data(row):
    """从 API 返回的行数据中提取作物信息以匹配 crops.json 格式"""
    phases = []
    for pd in row.get('phaseDetails', []):
        phases.append({
            'name': pd['name'],
            'seconds': pd['seconds'],
            'img': '',
        })
    # 添加成熟阶段 (seconds=0)
    phases.append({
        'name': '成熟',
        'seconds': 0,
        'img': '',
    })

    return {
        'seed_id': row.get('seedId', 0),
        'name': row.get('name', ''),
        'level': row.get('requiredLevel', 1),
        'price': row.get('price', 0),
        'exp': row.get('exp', 0),
        'fruitCount': row.get('fruitCount', 0),
        'fruitSellPrice': row.get('fruitSellPrice', 0),
        'seasons': row.get('seasons', 1),
        'phases': phases,
    }

def main():
    # 加载现有数据
    with open(CROPS_FILE, 'r', encoding='utf-8') as f:
        crops_data = json.load(f)

    existing_ids = {c['seed_id'] for c in crops_data['crops']}
    existing_levels = {c['level'] for c in crops_data['crops']}
    print(f"现有作物: {len(crops_data['crops'])} 种, 等级范围: Lv{min(existing_levels)}~Lv{max(existing_levels)}")

    new_crops = []
    seen_ids = set(existing_ids)

    for level in range(1, 16):
        print(f"\n抓取 Lv{level} 作物...")
        try:
            data = fetch_crops_for_level(level)
            rows = data.get('rowsFert', [])
            print(f"  返回 {len(rows)} 种作物")
            for row in rows:
                sid = row.get('seedId', 0)
                if sid not in seen_ids:
                    crop = extract_crop_data(row)
                    new_crops.append(crop)
                    seen_ids.add(sid)
                    print(f"  + 新作物: Lv{crop['level']} {crop['name']} (seedId={sid})")
            time.sleep(0.3)  # 礼貌延迟
        except Exception as e:
            print(f"  ❌ 抓取失败: {e}")

    if new_crops:
        # 合并并按等级排序
        all_crops = new_crops + crops_data['crops']
        all_crops.sort(key=lambda c: (c['level'], c['seed_id']))
        crops_data['crops'] = all_crops
        with open(CROPS_FILE, 'w', encoding='utf-8') as f:
            json.dump(crops_data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 新增 {len(new_crops)} 种作物，总计 {len(all_crops)} 种")
    else:
        print("\n无新增作物")

if __name__ == '__main__':
    main()
