import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

import openpyxl

EXCEL_PATH = 'same_name_tests.xlsx'

wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb['Same Name Tests']

# Build map of test_id -> apply decision
decisions = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    test_id, gcrs_name, lab, current, apply = row
    if test_id is None:
        continue
    decisions[int(test_id)] = str(apply).strip().upper() == 'YES'

with open('src/routes/rawData.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

enabled = 0
disabled = 0
for test in data['testData']:
    tid = test['id']
    if tid not in decisions:
        continue
    if decisions[tid]:
        test['is_simple_layout'] = True
        enabled += 1
    else:
        # Explicitly remove if it was previously set by this sheet
        if 'is_simple_layout' in test:
            test['is_simple_layout'] = False
        disabled += 1

with open('src/routes/rawData.json', 'w', encoding='utf-8', newline='') as f:
    json.dump(data, f, indent='\t', ensure_ascii=False)

print(f"Applied: {enabled} set to simple layout, {disabled} left/cleared.")
