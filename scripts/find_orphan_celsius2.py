import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

# °C not preceded by: a digit directly, OR a digit+space (e.g. "4 °C", "-20 °C")
bad_pattern = re.compile(r'(?<!\d)(?<!\d )\xb0C')

fields_to_check = ['requirement', 'test_handling']

seen = set()
rows = []
for entry in data['testData']:
    for field in fields_to_check:
        for block in (entry.get(field) or {}).get('blocks', []):
            text = (block.get('data') or {}).get('text', '')
            if bad_pattern.search(text):
                eid = entry['id']
                if eid not in seen:
                    seen.add(eid)
                    gcrs_blocks = (entry.get('GCRS_name') or {}).get('blocks', [])
                    gcrs = next((b['data']['text'] for b in gcrs_blocks if (b.get('data') or {}).get('text')), '')
                    rows.append((eid, gcrs))

rows.sort()
sys.stdout.write('Total affected tests: %d\n\n' % len(rows))
for eid, gcrs in rows:
    sys.stdout.write('ID=%-4d  %s\n' % (eid, gcrs))
