import unicodedata
from pathlib import Path
from bs4 import BeautifulSoup
import pandas as pd

def clean_text(s: str) -> str:
    return " ".join((s or "").replace("\xa0", " ").split())

def remove_accents(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.replace("Đ", "D").replace("đ", "d")

def key_text(s: str) -> str:
    return remove_accents(clean_text(s)).lower()

def get_cells(tr):
    return [
        clean_text(cell.get_text(" ", strip=True)) for cell in tr.find_all(["td", "th"])
    ]

def find_header_indexes(header_cells):
    """
    Bắt thêm các trường hợp cột tín chỉ ghi là "Số tín chỉ", "STC", "Tín chỉ"
    """
    normalized = [key_text(x) for x in header_cells]

    def find_col(condition):
        for i, h in enumerate(normalized):
            if condition(h):
                return i
        return None

    ma_idx = find_col(lambda h: "ma mon" in h)
    ten_idx = find_col(lambda h: "ten mon" in h)
    
    # Bắt rộng hơn cho cột tín chỉ
    tc_idx = find_col(lambda h: h == "tc" or h.startswith("tc ") or "tin chi" in h or "stc" in h)

    if ma_idx is None or ten_idx is None or tc_idx is None:
        return None

    return ma_idx, ten_idx, tc_idx

def extract_courses(html_file: Path) -> pd.DataFrame:
    soup = BeautifulSoup(
        html_file.read_text(encoding="utf-8", errors="ignore"), "html.parser"
    )

    rows = []
    
    # CHIẾN THUẬT MỚI: Tìm toàn bộ bảng trên trang web
    tables = soup.find_all("table")

    for table in tables:
        current_type = "Môn học khác"
        
        # Tìm tiêu đề phân loại môn học bằng cách "nhìn ngược" lên các dòng chữ phía trên bảng
        for prev in table.find_all_previous(["h2", "h3", "h4", "h5", "strong", "b", "p"]):
            text_key = key_text(prev.get_text(" ", strip=True))
            
            if len(text_key) > 200: # Bỏ qua các đoạn văn bản dài
                continue

            if "dai cuong" in text_key:
                current_type = "Môn đại cương"
                break
            elif "co so nganh" in text_key:
                current_type = "Môn cơ sở ngành"
                break
            elif "chuyen nganh" in text_key:
                current_type = "Môn chuyên ngành"
                break
            elif "tot nghiep" in text_key or "do an" in text_key or "khoa luan" in text_key:
                current_type = "Đồ án, thực tập"
                break
            elif "tu chon tu do" in text_key:
                current_type = "Môn tự do"
                break

        trs = table.find_all("tr")
        if not trs:
            continue

        # Kiểm tra header ở dòng 1
        indexes = find_header_indexes(get_cells(trs[0]))
        start_row = 1
        
        # Nếu dòng 1 không phải header (có thể do bị trộn ô merge cells), thử kiểm tra dòng 2
        if indexes is None and len(trs) > 1:
            indexes = find_header_indexes(get_cells(trs[1]))
            start_row = 2

        # Nếu bảng này không có cột Mã môn/Tên môn (VD: Bảng học phí, lịch học) -> Bỏ qua
        if indexes is None:
            continue

        ma_idx, ten_idx, tc_idx = indexes
        max_idx = max(ma_idx, ten_idx, tc_idx)

        for tr in trs[start_row:]:
            cells = get_cells(tr)

            if len(cells) <= max_idx:
                continue

            ma_mon = cells[ma_idx]
            ten_mon = cells[ten_idx]
            tc = cells[tc_idx]

            if not ten_mon:
                continue

            if not ma_mon and not tc and "tu chon" not in key_text(ten_mon):
                continue

            loai = current_type

            if "tu chon tu do" in key_text(ten_mon):
                loai = "Môn tự do"

            rows.append({
                "Mã môn học": ma_mon,
                "Tên môn học": ten_mon,
                "TC": tc,
                "Loại môn học": loai,
                "Độ khó": "",
            })

    return pd.DataFrame(rows)

if __name__ == "__main__":
    print("-" * 60)
    print(" CHƯƠNG TRÌNH TRÍCH XUẤT DỮ LIỆU MÔN HỌC UIT ".center(60, "*"))
    print("-" * 60)

    input_path_str = input("👉 Nhập đường dẫn file HTML (VD: html/HTTT_k19.html): ").strip()
    html_file_path = Path(input_path_str)

    if not html_file_path.exists():
        print(f"❌ LỖI: Không tìm thấy file '{html_file_path}'. Vui lòng kiểm tra lại tên hoặc đường dẫn!")
    else:
        output_name = input("👉 Nhập tên file lưu (KHÔNG CẦN gõ đuôi .csv, VD: httt_k19): ").strip()
        print("\n⏳ Đang xử lý dữ liệu...")
        
        try:
            df = extract_courses(html_file_path)

            # Đã bổ sung chặn lỗi khi dataframe rỗng
            if df.empty:
                print("\n❌ LỖI: Không bóc tách được môn học nào! Trang web này có thể không chứa bảng danh sách môn học hợp lệ.")
            else:
                print("\n✅ KẾT QUẢ TRÍCH XUẤT (5 dòng đầu):")
                print(df.head())
                
                print("\n📊 THỐNG KÊ SỐ MÔN THEO LOẠI:")
                print(df["Loại môn học"].value_counts().to_string())
                
                csv_file = f"{output_name}.csv"
                excel_file = f"{output_name}.xlsx"
                
                df.to_csv(csv_file, index=False, encoding="utf-8-sig")
                df.to_excel(excel_file, index=False)
                
                print(f"\n🎉 THÀNH CÔNG! Đã lưu dữ liệu vào 2 file:")
                print(f"   - {csv_file}")
                print(f"   - {excel_file}")
                print("-" * 60)
            
        except Exception as e:
            print(f"\n❌ LỖI TRONG QUÁ TRÌNH XỬ LÝ: {e}")