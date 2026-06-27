import re
from bs4 import BeautifulSoup
html = '<a href="/ics/tkb/2/2025">Nhấn vào đây để Thêm TKB vào GoogleCalendar/Calendar</a>'
soup = BeautifulSoup(html, 'html.parser')
a = soup.find('a', href=re.compile(r'^/ics/tkb/'))
print(a['href'] if a else None)
