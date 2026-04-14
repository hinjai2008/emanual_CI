import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

for entry in data['testData']:
    if entry['id'] == 9:
        for block in entry.get('requirement', {}).get('blocks', []):
            text = (block.get('data') or {}).get('text', '')
            if 'Additional information' in text and 'following link' in text.lower():
                print(repr(text))
        break
