import re
import json

def extract_exp_table():
    with open('levels.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'const EXP_TABLE = (\[.*?\]);', content, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        with open('data/exp_table.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Successfully extracted exp_table.json")
    else:
        print("Failed to find EXP_TABLE in levels.html")

if __name__ == '__main__':
    extract_exp_table()
