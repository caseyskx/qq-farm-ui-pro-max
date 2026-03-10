import json

def merge():
    with open('data/crops.json', 'r', encoding='utf-8') as f:
        crops = json.load(f)
        
    with open('/tmp/full_calc.json', 'r', encoding='utf-8') as f:
        full_calc = json.load(f)
        
    calc_map = {}
    for row in full_calc.get('rowsFert', []):
        calc_map[row['seedId']] = row
        
    for crop in crops['crops']:
        seed_id = crop['seed_id']
        if seed_id in calc_map:
            extra = calc_map[seed_id]
            crop['price'] = extra.get('price', 0)
            crop['fruitCount'] = extra.get('fruitCount', 0)
            crop['fruitSellPrice'] = extra.get('fruitSellPrice', 0)
            crop['base_yield'] = extra.get('fruitCount', 0) * extra.get('fruitSellPrice', 0)
            
    with open('data/crops.json', 'w', encoding='utf-8') as f:
        json.dump(crops, f, ensure_ascii=False, indent=2)
        
    print("Successfully merged price/yield data into crops.json")

if __name__ == '__main__':
    merge()
