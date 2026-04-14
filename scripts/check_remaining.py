import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)
check_ids = [629, 630, 631, 632, 818, 819, 820, 821, 881, 882]
for entry in data['testData']:
    if entry['id'] in check_ids:
        for block in entry.get('requirement', {}).get('blocks', []):
            text = (block.get('data') or {}).get('text', '')
            if 'Additional information' in text and 'following link' in text.lower():
                print('ID=%d: %s' % (entry['id'], repr(text)[:400]))
