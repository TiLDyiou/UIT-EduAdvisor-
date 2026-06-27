import csv
import os
import re

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ LỖI: Máy tính của bạn chưa cài đặt thư viện BeautifulSoup.")
    print("👉 Hãy mở Terminal/CMD và gõ lệnh sau để cài đặt: pip install beautifulsoup4")
    exit()

# Biểu thức chính quy nhận diện Mã môn học (Ví dụ: CE121, ELEC1310, IT001, MATH1110)
CODE_PATTERN = re.compile(r'^[A-Z]{2,4}\d{3,4}[A-Z]?$|^[A-Z]{2,4}\*{3}$')

def process_html_file(html_file, csv_file):
    if not os.path.isfile(html_file):
        print(f"❌ LỖI: Không tìm thấy file '{html_file}'. Vui lòng kiểm tra lại!")
        return False

    print(f"⏳ Trình cào dữ liệu V8.0 đang xử lý file song song: {html_file}...")
    
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    courses = []
    seen_keys = set()
    
    for row in soup.find_all('tr'):
        cells = [cell.get_text(strip=True) for cell in row.find_all(['th', 'td'])]
        
        # Tìm tất cả các ô có cấu trúc giống Mã Môn Học trên hàng này
        all_code_indices = [i for i, token in enumerate(cells) if CODE_PATTERN.match(token)]
        
        # --- TRƯỜNG HỢP A: BẢNG SONG SONG DUAL-CODE (Ví dụ: Hệ Newcastle) ---
        if len(all_code_indices) >= 2:
            idx_uit = all_code_indices[0]
            idx_newcastle = all_code_indices[1]
            
            ma_uit = cells[idx_uit]
            ten_uit = cells[idx_uit + 1] if idx_uit + 1 < len(cells) else ''
            
            # Tìm số tín chỉ của UIT (nằm trước mã môn Newcastle)
            tc_uit = '0'
            for k in range(idx_uit + 2, idx_newcastle):
                if cells[k].isdigit():
                    tc_uit = cells[k]
                    break
            
            ma_new = cells[idx_newcastle]
            ten_new = cells[idx_newcastle + 1] if idx_newcastle + 1 < len(cells) else ''
            
            # Tìm số tín chỉ của Newcastle (nằm sau tên môn Newcastle)
            tc_new = '0'
            for k in range(idx_newcastle + 2, len(cells)):
                if cells[k].isdigit():
                    tc_new = cells[k]
                    break

            if ten_uit and ten_uit.lower() not in ["tên tiếng việt", "tên môn học"]:
                key = (ma_uit, ten_uit, ma_new)
                if key not in seen_keys:
                    seen_keys.add(key)
                    courses.append({
                        'Mã MH UIT': ma_uit, 'Tên Môn Học UIT': ten_uit, 'TC UIT': tc_uit,
                        'Mã MH Đối Tác': ma_new, 'Tên Môn Học Đối Tác': ten_new, 'TC Đối Tác': tc_new
                    })

        # --- TRƯỜNG HỢP B: BẢNG ĐƠN CODE CHUẨN HOẶC HỆ LIÊN KẾT ĐƠN (KTPM, TTDPT, Birmingham) ---
        elif len(all_code_indices) == 1:
            code_idx = all_code_indices[0]
            ma_mh = cells[code_idx]
            
            # Thử tìm điểm neo theo loại môn "bắt buộc/tự chọn"
            type_idx = -1
            for i, token in enumerate(cells):
                if i > code_idx and ("bắt buộc" in token.lower() or "tự chọn" in token.lower()):
                    type_idx = i
                    break
            
            if type_idx != -1:
                name_parts = [c for c in cells[code_idx + 1 : type_idx] if c]
                ten_mh = " / ".join(name_parts)
                tc = cells[type_idx + 1] if type_idx + 1 < len(cells) else '0'
            else:
                ten_mh = cells[code_idx + 1] if code_idx + 1 < len(cells) else ''
                remaining_tokens = [c for c in cells[code_idx + 2:] if c]
                tc = remaining_tokens[0] if remaining_tokens and (remaining_tokens[0].isdigit() or "tính" in remaining_tokens[0].lower()) else '0'
            
            if ten_mh and ten_mh.lower() not in ["tên môn học", "tên môn"]:
                key = (ma_mh, ten_mh, 'N/A')
                if key not in seen_keys:
                    seen_keys.add(key)
                    courses.append({
                        'Mã MH UIT': ma_mh, 'Tên Môn Học UIT': ten_mh, 'TC UIT': tc,
                        'Mã MH Đối Tác': 'N/A', 'Tên Môn Học Đối Tác': 'N/A', 'TC Đối Tác': '0'
                    })

        # --- TRƯỜNG HỢP C: PHI CHUẨN KHÔNG MÃ (Hệ Birmingham cũ) ---
        else:
            if len(cells) >= 4 and cells[0] not in ["Tên môn học", "Tên môn", ""] and (cells[1].isdigit() or cells[1] == ''):
                ten_mh = cells[0]
                tc = cells[1] if cells[1] else '0'
                key = ('Hệ Liên Kết', ten_mh, 'N/A')
                if key not in seen_keys:
                    seen_keys.add(key)
                    courses.append({
                        'Mã MH UIT': 'Hệ Liên Kết', 'Tên Môn Học UIT': ten_mh, 'TC UIT': tc,
                        'Mã MH Đối Tác': 'N/A', 'Tên Môn Học Đối Tác': 'N/A', 'TC Đối Tác': '0'
                    })

    if not courses:
        print("❌ LỖI: Không trích xuất được dữ liệu hợp lệ.")
        return False

    if not csv_file.endswith('.csv'):
        csv_file += '.csv'

    # Ghi file với cấu trúc mở rộng toàn năng
    headers = ['Mã MH UIT', 'Tên Môn Học UIT', 'TC UIT', 'Mã MH Đối Tác', 'Tên Môn Học Đối Tác', 'TC Đối Tác']
    try:
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(courses)
        print(f"✅ THÀNH CÔNG RỰC RỠ: Đã bóc tách trọn vẹn {len(courses)} hàng môn học vào '{csv_file}'\n")
        return True
    except Exception as e:
        print(f"❌ LỖI khi lưu file CSV: {e}")
        return False

def main():
    print("==================================================")
    print("  TOOL TRÍCH XUẤT V8.0 (DUAL-ALIGNMENT MATRIX)   ")
    print("==================================================")
    while True:
        html_file = input("👉 Nhập đường dẫn file HTML (hoặc gõ 'q' để thoát): ").strip()
        if html_file.lower() == 'q': break
        csv_file = input("👉 Nhập tên file CSV muốn lưu (vd: newcastle.csv): ").strip()
        if csv_file.lower() == 'q': break
        process_html_file(html_file, csv_file)

if __name__ == "__main__":
    main()