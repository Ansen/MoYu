import requests

def test():
    url = "https://zh.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=Appendix:%E4%B8%AD%E6%96%87%E7%94%B5%E7%A0%81/%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%861983&format=json"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)
    pages = res.json().get('query', {}).get('pages', {})
    for k, v in pages.items():
        print(v['revisions'][0]['*'][:1000])

if __name__ == '__main__':
    test()
