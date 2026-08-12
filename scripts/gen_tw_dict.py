import json
import zhtelecode
import sys

try:
    char_to_code = {}
    code_to_char = {}
    
    # In zhtelecode, codebooks are just strings where index = code
    tb = zhtelecode._TAIWAN_CODEBOOK
    
    for i, char in enumerate(tb):
        if char and char != ' ':
            # Usually telecodes are 4 digits.
            code_str = str(i).zfill(4)
            code_to_char[code_str] = char
            char_to_code[char] = code_str
            
    mapping = {
        "version": "1.0",
        "name": "1983_Taiwan",
        "charToCode": char_to_code,
        "codeToChar": code_to_char
    }
    
    with open('public/dict/mapping_taiwan.json', 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
        
    print(f"Success: Generated mapping_taiwan.json with {len(code_to_char)} codes")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
