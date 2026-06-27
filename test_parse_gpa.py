import sys
from bs4 import BeautifulSoup
import re

html = open("daa_grades_summary_debug.html").read()
soup = BeautifulSoup(html, "html.parser")
all_trs = soup.find_all("tr")
decimal_re = re.compile(r"\d+[.,]\d+")

for tr in all_trs:
    cells = tr.find_all("td")
    if not cells: continue
    label = cells[0].get_text(" ", strip=True).lower()
    import unicodedata
    label = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    label = label.replace("\u0111", "d").replace("\u0110", "d")
    if "diem trung binh chung tich luy" in label:
        print("TICH LUY ROW:", [c.get_text(" ", strip=True) for c in cells])
    elif "diem trung binh chung" in label:
        print("CHUNG ROW:", [c.get_text(" ", strip=True) for c in cells])

