"""
Sync form_external_link in testData form blocks from the latest formData,
matched by form_ref_id <-> formData[].refId.
"""

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RAW_DATA_PATH = Path(__file__).parent.parent / "src" / "routes" / "rawData.json"

data = json.loads(RAW_DATA_PATH.read_text(encoding="utf-8"))

# Build map: str(refId) -> external_link text from formData
ext_link_map: dict[str, str] = {}
for form in data["formData"]:
    ref_id = str(form.get("refId", ""))
    if not ref_id:
        continue
    fel = form.get("form_external_link", {})
    blocks = fel.get("blocks", []) if isinstance(fel, dict) else []
    link_text = ""
    for blk in blocks:
        text = blk.get("data", {}).get("text", "")
        if text:
            link_text = text
            break
    ext_link_map[ref_id] = link_text

# Update test entries
updated_count = 0
already_ok_count = 0
skipped_count = 0

for test in data["testData"]:
    test_id = test.get("id")
    form_field = test.get("form", {})
    if not isinstance(form_field, dict):
        continue
    blocks = form_field.get("blocks", [])
    for blk in blocks:
        if blk.get("type") != "form":
            continue
        form_data = blk.get("data", {}).get("form", {})
        ref_id = str(form_data.get("form_ref_id", ""))
        if not ref_id:
            skipped_count += 1
            continue
        if ref_id not in ext_link_map:
            print(f"  [WARN] Test id={test_id}: form_ref_id={ref_id} not found in formData")
            skipped_count += 1
            continue
        new_link = ext_link_map[ref_id]
        old_link = form_data.get("form_external_link", "")
        if old_link == new_link:
            already_ok_count += 1
            continue
        print(f"  [UPDATE] Test id={test_id}: '{old_link}' -> '{new_link}'")
        form_data["form_external_link"] = new_link
        updated_count += 1

print(f"\nDone. Updated: {updated_count}, Already OK: {already_ok_count}, Skipped (no ref_id/not found): {skipped_count}")

if updated_count > 0:
    RAW_DATA_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print("rawData.json saved.")
else:
    print("No changes written.")
