import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

# Build labName -> intranet_link map (first match per labName)
lab_link_map = {}
for lab in data['config']['laboratories']:
    name = lab.get('labName', '')
    if name and name not in lab_link_map:
        lab_link_map[name] = lab.get('intranet_link', '')

# Regex to match the entire <a> tag (href may be any value, inner text has no < chars)
# Handles both with and without rel="noopener noreferrer"
a_tag_re = re.compile(r'<a href="[^"]*" target="_blank"(?: rel="noopener noreferrer")?>[^<]*</a>')

changes = []

for entry in data['testData']:
    lac_blocks = (entry.get('lab_and_category') or {}).get('blocks', [])
    lab_names = [b['data']['labName'] for b in lac_blocks if (b.get('data') or {}).get('labName')]
    if not lab_names:
        continue
    first_lab = lab_names[0]
    intranet_link = lab_link_map.get(first_lab, '')

    req = entry.get('requirement') or {}
    for block in req.get('blocks', []):
        block_data = block.get('data') or {}
        text = block_data.get('text', '')
        if 'Additional information' in text and 'following link' in text.lower():
            new_a = f'<a href="{intranet_link}" target="_blank" rel="noopener noreferrer">{first_lab} Website / Lab Manual</a>'
            new_text = a_tag_re.sub(new_a, text)
            if new_text != text:
                block_data['text'] = new_text
                changes.append({
                    'test_id': entry['id'],
                    'lab_name': first_lab,
                    'intranet_link': intranet_link,
                    'old_snippet': a_tag_re.search(text).group(0) if a_tag_re.search(text) else '',
                })

with open('src/routes/rawData.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent='\t')

# --- Summary ---
print(f'Modified {len(changes)} blocks across {len(set(c["test_id"] for c in changes))} test entries.\n')

print('=== LAB -> INTRANET LINK MAPPING APPLIED ===')
seen = set()
for c in changes:
    key = (c['lab_name'], c['intranet_link'])
    if key not in seen:
        seen.add(key)
        print(f'  {c["lab_name"]}')
        print(f'    -> {c["intranet_link"]}')
print()

print('=== CHANGES PER TEST ENTRY ===')
for c in changes:
    print(f'  ID={c["test_id"]:4d}  lab={c["lab_name"]}')
    print(f'           old: {c["old_snippet"][:80]}')
    print(f'           new: <a href="{c["intranet_link"]}" ...>{c["lab_name"]} website/lab manual</a>')
