import json
import time
import os

# File paths
txt_file = 'allTests.txt'
json_file = 'rawData.json'
output_file = 'new_tests.json'

def create_editorjs_block(text_value):
    """Helper to create the nested Editor.js block format."""
    return {
        "time": int(time.time() * 1000),
        "blocks": [
            {
                "id": "gen_" + str(int(time.time() * 1000))[5:],
                "type": "paragraph",
                "data": {
                    "text": text_value
                }
            }
        ],
        "version": "2.31.0-rc.7"
    }

def main():
    print("Starting script...")
    
    # Pre-define variables so they never throw a NameError
    all_tests = []
    existing_gcrs_names = set()
    test_data_array = []
    
    # 1. Load the text file safely
    if not os.path.exists(txt_file):
        print(f"Error: Could not find {txt_file}")
        return
        
    with open(txt_file, 'r', encoding='utf-8') as f:
        for line in f:
            clean_line = line.strip()
            if clean_line and not clean_line.startswith("#"):
                all_tests.append(clean_line)
    
    # 2. Load the existing JSON file safely
    if not os.path.exists(json_file):
        print(f"Error: Could not find {json_file}")
        return

    with open(json_file, 'r', encoding='utf-8') as f:
        try:
            test_data_array = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {json_file}: {e}")
            return

    print(f"Found {len(test_data_array)} existing tests in {json_file}.")
    
    # Loop through existing tests
    for test_item in test_data_array:
        if 'GCRS_name' in test_item and isinstance(test_item['GCRS_name'], dict) and 'blocks' in test_item['GCRS_name']:
            for block in test_item['GCRS_name']['blocks']:
                if 'data' in block and 'text' in block['data']:
                    clean_name = block['data']['text'].replace('<br>', '').strip().lower()
                    existing_gcrs_names.add(clean_name)

    # 3. Find missing tests
    missing_tests = []
    for test_name in all_tests:
        if test_name.lower() not in existing_gcrs_names:
            missing_tests.append(test_name)

    print(f"Found {len(missing_tests)} missing tests that need to be generated.")

    # 4. Generate new JSON objects for missing tests
    new_json_objects = []
    start_id = 445 
    current_time = int(time.time() * 1000)

    for i, test_name in enumerate(missing_tests):
        new_test = {
            "id": start_id + i,
            "refId": current_time + i,
            "full_name": create_editorjs_block(test_name),
            "GCRS_name": create_editorjs_block(test_name),
            "label_name": create_editorjs_block(test_name),
            "synonyms": {
                "blocks": [{"type": "synonyms", "data": {"synonymList": []}}]
            },
            "turn_around_time": create_editorjs_block(""),
            "requirement": create_editorjs_block(""),
            "lab_and_category": create_editorjs_block(""),
            "specimen_type": create_editorjs_block(""),
            "test_handling": create_editorjs_block(""),
            "container": create_editorjs_block(""),
            "form": create_editorjs_block("")
        }
        new_json_objects.append(new_test)

    # 5. Save to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(new_json_objects, f, indent=2, ensure_ascii=False)

    print(f"Success! Generated new template objects and saved them to {output_file}.")

if __name__ == "__main__":
    main()