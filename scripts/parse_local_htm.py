import os
from bs4 import BeautifulSoup
import json
import re

def parse_local_html():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    html_path = os.path.join(base_dir, 'data', '附錄_中文电码_中国大陆1983 - 维基词典，自由的多语言词典.htm')
    
    print(f"Reading data from {html_path}...")
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    char_to_code = {}
    code_to_char = {}
    
    # Tables in wiktionary typically have class 'wikitable'
    tables = soup.find_all('table', class_='wikitable')
    print(f"Found {len(tables)} wikitables.")
    
    for table in tables:
        for row in table.find_all('tr'):
            cells = row.find_all(['td', 'th'])
            for i in range(len(cells) - 1):
                # The wiktionary table cells might contain something like:
                # <td>0001<br/><span>一</span></td>
                # Let's extract raw text and see if it looks like "0001一" or something
                c1_text = cells[i].get_text(separator=' ', strip=True)
                c2_text = cells[i+1].get_text(separator=' ', strip=True)
                
                # If cells are strictly Code -> Char
                if re.match(r'^\d{4}$', c1_text) and len(c2_text) >= 1:
                    code = c1_text
                    char = c2_text.split()[0][0] # take the first actual character
                    char_to_code[char] = code
                    code_to_char[code] = char
                    
            # Some wiktionary cells have BOTH code and char in ONE cell:
            # <td>0001<br/>一</td>
            for cell in cells:
                cell_text = cell.get_text(separator=' ', strip=True)
                # Look for "0001 一" or "0001一"
                m = re.match(r'^(\d{4})\s*(\S)', cell_text)
                if m:
                    code = m.group(1)
                    char = m.group(2)
                    if code not in code_to_char:
                        char_to_code[char] = code
                        code_to_char[code] = char

    if not char_to_code:
        print("No matches in tables. Trying raw text regex...")
        text = soup.get_text(separator=' ')
        # Match exactly "0001 一" etc
        matches = re.finditer(r'(\d{4})\s+([^\s\d\x00-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]{1})', text)
        for m in matches:
            code = m.group(1)
            char = m.group(2)
            if code not in code_to_char:
                char_to_code[char] = code
                code_to_char[code] = char
                
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

    out_dir = os.path.join(base_dir, 'web', 'public', 'dict')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'mapping.json')
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({
            "version": "1.4",
            "name": "LocalHTML_1983_with_Punctuation",
            "charToCode": char_to_code,
            "codeToChar": code_to_char
        }, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    parse_local_html()
