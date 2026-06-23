import sys
from apps.api.app.services.daa.parser import parse_class_code_info

html = open("docs/fd.html").read()
print(parse_class_code_info(html))
