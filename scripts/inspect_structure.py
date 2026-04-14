import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/routes/rawData.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== Alert Tags ===')
for a in data['config'].get('alertTag', []):
    print(a)

print()
print('=== Categories ===')
for c in data['config'].get('category', []):
    print(c)

print()
print('=== Sample forms (first 8) ===')
for frm in data['formData'][:8]:
    name = frm.get('form_name', {}).get('blocks', [{}])[0].get('data', {}).get('text', '')
    code = frm.get('form_code', {}).get('blocks', [{}])[0].get('data', {}).get('text', '')
    fid = frm['id']
    print('  id=' + str(fid) + '  code=' + code + '  name=' + name)

print()
print('=== requirement with link ===')
for t in data['testData']:
    for b in t.get('requirement', {}).get('blocks', []):
        txt = b.get('data', {}).get('text', '')
        if '<a ' in txt:
            print('test ' + str(t['id']) + ': ' + txt[:300])
            break
    else:
        continue
    break

print()
print('=== test_handling sample ===')
for t in data['testData']:
    blocks = t.get('test_handling', {}).get('blocks', [])
    if blocks:
        print('test ' + str(t['id']) + ':')
        for b in blocks[:2]:
            print('  ' + str(b.get('data', {}).get('text', ''))[:120])
        break

print()
print('=== form block sample ===')
for t in data['testData']:
    for b in t.get('form', {}).get('blocks', []):
        if b['type'] == 'form' and b['data']['form'].get('form_code'):
            print(b['data'])
            break
    else:
        continue
    break
