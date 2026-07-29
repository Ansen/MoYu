import requests
import json
import re
import os

def fetch_wiktionary_data():
    url = "https://zh.wiktionary.org/w/api.php"
    params = {
        "action": "query",
        "prop": "revisions",
        "rvprop": "content",
        "titles": "Appendix:中文电码/中国大陆1983",
        "format": "json"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    print("Fetching Wikitext from Wikipedia API...")
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    pages = data.get("query", {}).get("pages", {})
    
    char_to_code = {}
    code_to_char = {}
    
    for page_id, page_info in pages.items():
        if "revisions" in page_info:
            content = page_info["revisions"][0]["*"]
            
            # Pattern: 0001<br /><span style="font-size:200%">-{[[一]]}-</span>
            matches = re.finditer(r'(\d{4})<br\s*/>.*?\[\[(.*?)\]\]', content)
            for m in matches:
                code = m.group(1)
                char = m.group(2).strip()
                # If there are multiple characters like in a link "一|一", take the first
                char = char.split('|')[0].strip()
                if len(char) >= 1:
                    actual_char = char[0]
                    char_to_code[actual_char] = code
                    code_to_char[code] = actual_char
                    
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
        if char not in char_to_code:
            char_to_code[char] = code
            code_to_char[code] = char

    print(f"Extracted {len(char_to_code)} characters.")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(base_dir, 'web', 'public', 'dict')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'mapping.json')
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({
            "version": "1.3",
            "name": "Wikipedia_1983_with_Punctuation",
            "charToCode": char_to_code,
            "codeToChar": code_to_char
        }, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    fetch_wiktionary_data()
