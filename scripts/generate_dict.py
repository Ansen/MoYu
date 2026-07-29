import re
import json
import os

def parse_sql_to_dict(sql_file_path):
    char_to_code = {}
    code_to_char = {}
    
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Match: INSERT INTO "Code" VALUES(1,'一');
            # Or: INSERT INTO Code VALUES(1,'一');
            match = re.search(r"VALUES\((\d+),\s*'(.+?)'\)", line)
            if match:
                num_str = match.group(1)
                char = match.group(2)
                
                # Zero-pad to 4 digits
                code_str = num_str.zfill(4)
                
                char_to_code[char] = code_str
                code_to_char[code_str] = char
                
    # Add common punctuation in the 99xx range
    # 常用中文标点及英文标点
    punctuations = [
        ('，', '9901'), ('。', '9902'), ('！', '9903'), ('？', '9904'),
        ('、', '9905'), ('；', '9906'), ('：', '9907'), ('“', '9908'),
        ('”', '9909'), ('‘', '9910'), ('’', '9911'), ('（', '9912'),
        ('）', '9913'), ('【', '9914'), ('】', '9915'), ('《', '9916'),
        ('》', '9917'), ('-', '9918'), ('——', '9919'), ('…', '9920'),
        (',', '9921'), ('.', '9922'), ('!', '9923'), ('?', '9924'),
        (' ', '9925'), ('\n', '9926')
    ]
    
    for char, code in punctuations:
        char_to_code[char] = code
        code_to_char[code] = char

    return {
        "version": "1.0",
        "name": "Standard_1983_with_Punctuation",
        "charToCode": char_to_code,
        "codeToChar": code_to_char
    }

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sql_path = os.path.join(base_dir, 'data', '1983.sql')
    out_dir = os.path.join(base_dir, 'web', 'public', 'dict')
    
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'mapping.json')
    
    mapping_data = parse_sql_to_dict(sql_path)
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(mapping_data, f, ensure_ascii=False, indent=2)
        
    print(f"Generated mapping dictionary at {out_path} with {len(mapping_data['charToCode'])} entries.")

if __name__ == "__main__":
    main()
