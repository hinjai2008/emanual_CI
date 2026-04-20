"""
Scan test entries for "Additional information and guidelines" sentences and
compare the embedded href with the correct intranet_link from config.laboratories
(matched by labName from lab_and_category).  Prints a summary and applies fixes.
"""

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

RAW_DATA_PATH = Path(__file__).parent.parent / "src" / "routes" / "rawData.json"

data = json.loads(RAW_DATA_PATH.read_text(encoding="utf-8"))

# Build a labName -> intranet_link map (first entry wins if duplicates)
lab_link_map: dict[str, str] = {}
for lab in data["config"]["laboratories"]:
    name = lab.get("labName", "")
    link = lab.get("intranet_link", "")
    if name and link and name not in lab_link_map:
        lab_link_map[name] = link

PATTERN = re.compile(r'Additional information and guidelines', re.IGNORECASE)
HREF_PATTERN = re.compile(r'href="([^"]+)"')

summary_rows = []
fix_count = 0
already_ok_count = 0
no_lab_count = 0

for test in data["testData"]:
    test_id = test.get("id")

    # Get labName(s) from lab_and_category
    lab_names: list[str] = []
    lac = test.get("lab_and_category")
    if lac and "blocks" in lac:
        for blk in lac["blocks"]:
            lab_name = blk.get("data", {}).get("labName", "")
            if lab_name:
                lab_names.append(lab_name)

    # Search all block text fields across all block-format fields
    for field_name, field_value in test.items():
        if not isinstance(field_value, dict) or "blocks" not in field_value:
            continue
        for blk in field_value["blocks"]:
            text = blk.get("data", {}).get("text", "")
            if not text or not PATTERN.search(text):
                continue

            href_match = HREF_PATTERN.search(text)
            current_href = href_match.group(1) if href_match else None

            if not lab_names:
                summary_rows.append({
                    "test_id": test_id,
                    "field": field_name,
                    "current_href": current_href,
                    "expected_href": None,
                    "status": "NO_LAB_CATEGORY",
                })
                no_lab_count += 1
                continue

            # Use first lab name (tests with multiple labs are unusual here)
            lab_name = lab_names[0]
            expected_href = lab_link_map.get(lab_name)

            if not expected_href:
                summary_rows.append({
                    "test_id": test_id,
                    "field": field_name,
                    "lab_name": lab_name,
                    "current_href": current_href,
                    "expected_href": None,
                    "status": "LAB_NOT_IN_CONFIG",
                })
                no_lab_count += 1
                continue

            if current_href == expected_href:
                summary_rows.append({
                    "test_id": test_id,
                    "field": field_name,
                    "lab_name": lab_name,
                    "current_href": current_href,
                    "expected_href": expected_href,
                    "status": "OK",
                })
                already_ok_count += 1
            else:
                # Apply fix
                new_text = text.replace(f'href="{current_href}"', f'href="{expected_href}"')
                blk["data"]["text"] = new_text
                summary_rows.append({
                    "test_id": test_id,
                    "field": field_name,
                    "lab_name": lab_name,
                    "current_href": current_href,
                    "expected_href": expected_href,
                    "status": "FIXED",
                })
                fix_count += 1

# Print summary
print(f"\n{'='*80}")
print(f"SUMMARY: {len(summary_rows)} occurrence(s) found")
print(f"  FIXED:      {fix_count}")
print(f"  ALREADY OK: {already_ok_count}")
print(f"  ISSUES:     {no_lab_count}")
print(f"{'='*80}\n")

col_w = [8, 12, 14, 56, 56]
header = f"{'Status':<14} {'TestID':<8} {'Field':<12} {'Current href':<56} {'Expected href':<56}"
print(header)
print("-" * len(header))
for row in summary_rows:
    status = row["status"]
    tid = str(row["test_id"])
    field = row.get("field", "")
    cur = row.get("current_href") or "(none)"
    exp = row.get("expected_href") or "(none)"
    print(f"{status:<14} {tid:<8} {field:<12} {cur:<56} {exp:<56}")

if fix_count > 0:
    RAW_DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent="\t"), encoding="utf-8")
    print(f"\n✓ rawData.json updated with {fix_count} fix(es).")
else:
    print("\nNo changes written.")
