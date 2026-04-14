import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('src/routes/rawData.json', encoding='utf-8') as f:
    data = json.load(f)

bad_pattern = re.compile(r'(?<!\d)(?<!\d )\xb0C')

fields_to_fix = ['requirement', 'test_handling']

total_replacements = 0
affected_tests = set()

for entry in data['testData']:
    for field in fields_to_fix:
        field_data = entry.get(field) or {}
        for block in field_data.get('blocks', []):
            block_data = block.get('data') or {}
            text = block_data.get('text', '')
            new_text, count = bad_pattern.subn('4\xb0C', text)
            if count:
                block_data['text'] = new_text
                total_replacements += count
                affected_tests.add(entry['id'])

with open('src/routes/rawData.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent='\t')

sys.stdout.write('Fixed %d replacements across %d tests.\n' % (total_replacements, len(affected_tests)))
