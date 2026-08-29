import os
import re
import json

def test_locales():
    print("--- Running Locales (zh/en) Python Verification ---")
    locales_path = os.path.join(os.path.dirname(__file__), "..", "src", "i18n", "locales.js")
    with open(locales_path, "r", encoding="utf-8") as f:
        content = f.read()

    required_keys = [
        "reader.more",
        "reader.more.layout",
        "reader.more.font",
        "reader.view.grid",
        "reader.view.gridDesc",
        "reader.view.text",
        "reader.view.textDesc",
        "reader.number.mode",
        "reader.number.long",
        "reader.number.short5",
        "reader.number.short10",
        "reader.font.consolas",
        "reader.font.cascadia",
        "reader.font.jetbrains",
        "reader.font.courier",
        "reader.font.fira",
        "reader.font.sans"
    ]

    for key in required_keys:
        matches = len(re.findall(re.escape(f"'{key}'"), content))
        if matches < 2:
            raise AssertionError(f"Key '{key}' not found in both zh and en dictionaries (found {matches} occurrences)")
        print(f"✓ Key '{key}' found in zh and en ({matches} occurrences)")

    print("All Python locale verification passed!\n")

def test_fonts_config():
    print("--- Running Fonts Config Python Verification ---")
    fonts_path = os.path.join(os.path.dirname(__file__), "..", "src", "config", "fonts.js")
    with open(fonts_path, "r", encoding="utf-8") as f:
        content = f.read()

    for font_id in ["Consolas", "Cascadia Mono", "JetBrains Mono", "Courier New", "Fira Code", "system-sans"]:
        if font_id not in content:
            raise AssertionError(f"Font id '{font_id}' missing in src/config/fonts.js")
        print(f"✓ Font '{font_id}' present in config")

    print("All Python font verification passed!\n")

if __name__ == "__main__":
    print("========================================")
    print("   MoYu Reader Python Unit Tests        ")
    print("========================================")
    test_locales()
    test_fonts_config()
    print("========================================")
    print("🎉 ALL PYTHON UNIT TESTS PASSED!        ")
    print("========================================")
