import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

# Build lab name -> intranet_link map (first match per labName)
lab_link_map = {}
for lab in data['config']['laboratories']:
    name = lab.get('labName', '')
    if name and name not in lab_link_map:
        lab_link_map[name] = lab.get('intranet_link', '')

found = []
for entry in data['testData']:
    req = entry.get('requirement', {})
    for block in req.get('blocks', []):
        text = (block.get('data') or {}).get('text', '')
        if 'Additional information' in text and 'following link' in text.lower():
            lac_blocks = entry.get('lab_and_category', {}).get('blocks', [])
            lab_names = [b['data']['labName'] for b in lac_blocks if b.get('data', {}).get('labName')]
            found.append({
                'id': entry['id'],
                'lab_names': lab_names,
                'text': text,
                'block_id': block.get('id', '')
            })

print(f'Total matching blocks: {len(found)}\n')
for item in found:
    print(f"ID={item['id']}  labs={item['lab_names']}")
    for ln in item['lab_names']:
        print(f"  -> intranet_link: {lab_link_map.get(ln, 'NOT FOUND')}")
    print(f"  TEXT: {item['text'][:200]}")
    print()
