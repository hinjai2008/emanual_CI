import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

# °C not preceded by a digit (valid: "37°C", "-20°C", "4.5°C")
bad_pattern = re.compile(r'(?<!\d)°C')

fields_to_check = ['requirement', 'test_handling']

results = []
for entry in data['testData']:
    for field in fields_to_check:
        field_data = entry.get(field) or {}
        for block in field_data.get('blocks', []):
            text = (block.get('data') or {}).get('text', '')
            if bad_pattern.search(text):
                name_blocks = (entry.get('full_name') or {}).get('blocks', [])
                name = next((b['data']['text'] for b in name_blocks if (b.get('data') or {}).get('text')), '')
                results.append((entry['id'], name, field, text))

print('Found %d block(s) with orphaned °C:\n' % len(results))
for test_id, name, field, text in results:
    # Show the context around each bad match
    for m in bad_pattern.finditer(text):
        start = max(0, m.start() - 20)
        end = min(len(text), m.end() + 20)
        snippet = text[start:end].replace('\n', ' ')
        print('  ID=%-4d  field=%-14s  name=%s' % (test_id, field, name))
        print('           context: ...%s...' % snippet)
