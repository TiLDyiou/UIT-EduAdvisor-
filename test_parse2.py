import sys
from io import BytesIO
import openpyxl

sys.path.insert(0, '/home/tildy/Documents/UIT-EduAdvisor-/apps/api')
from app.services.academic.excel_parser import parse_tkb_excel

with open('/home/tildy/Documents/UIT-EduAdvisor-/docs/tkb_courses_22-08-2025_hk_1_nh2025.xlsx', 'rb') as f:
    data = f.read()
sections = parse_tkb_excel(data)
codes = set(s.course_code for s in sections)
print(f"Unique codes: {len(codes)}")
import json
body = json.dumps(list(codes))
print(f"Body size: {len(body)} bytes")
