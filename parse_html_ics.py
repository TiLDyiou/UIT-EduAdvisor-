import re
from bs4 import BeautifulSoup
with open("docs/input.html", "r") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")
ics_link = soup.find("a", href=re.compile(r"ics/tkb"))
print(f"ics_link={ics_link}")
