import sys
from io import BytesIO
import openpyxl

sys.path.insert(0, '/home/tildy/Documents/UIT-EduAdvisor-/apps/api')
from app.services.academic.excel_parser import parse_tkb_excel

try:
    with open('/home/tildy/Documents/UIT-EduAdvisor-/docs/tkb_courses_22-08-2025_hk_1_nh2025.xlsx', 'rb') as f:
        data = f.read()
    sections = parse_tkb_excel(data)
    print(f"Parsed {len(sections)} sections successfully.")
except Exception as e:
    import traceback
    traceback.print_exc()
