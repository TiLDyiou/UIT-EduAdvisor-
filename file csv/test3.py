import unicodedata
from pathlib import Path
from bs4 import BeautifulSoup
import pandas as pd

print("\n" + "="*60)
print(" ĐANG CHẠY BẢN CODE V4.6 (FIX LỖI MẤT MÃ MÔN HỆ BCU) ".center(60, " "))
print("="*60 + "\n")

def clean_text(s: str) -> str:
    return " ".join((s or "").replace("\xa0", " ").split())

def remove_accents(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.replace("Đ", "D").replace("đ", "d")

def key_text(s: str) -> str:
    return remove_accents(clean_text(s)).lower()

def detect_type(text_key: str, current_type: str) -> str:
    if "dai cuong" in text_key:
        return "Môn đại cương"
    elif "co so nganh" in text_key:
        return "Môn cơ sở ngành"
    elif "chuyen nganh" in text_key:
        return "Môn chuyên ngành"
    elif any(k in text_key for k in ["tot nghiep", "do an", "khoa luan", "project"]):
        return "Đồ án, thực tập"
    elif "tu chon tu do" in text_key:
        return "Môn tự do"
    elif any(k in text_key for k in ["giai doan 1", "bcu 1", "birmingham 1", "newcastle 1"]):
        return "Giai đoạn 1"
    elif any(k in text_key for k in ["giai doan 2", "bcu 2", "birmingham 2", "newcastle 2"]):
        return "Giai đoạn 2"
    elif "nam 1" in text_key or "year 1" in text_key:
        return "Năm 1"
    elif "nam 2" in text_key or "year 2" in text_key:
        return "Năm 2"
    elif "nam 3" in text_key or "year 3" in text_key:
        return "Năm 3"
    elif "nam 4" in text_key or "year 4" in text_key:
        return "Năm 4"
    return current_type

def table_to_grid(table):
    rows = table.find_all("tr")
    grid = {}
    max_cols = 0
    
    for r_idx, row in enumerate(rows):
        c_idx = 0
        for cell in row.find_all(["td", "th"]):
            while (r_idx, c_idx) in grid:
                c_idx += 1
                
            rowspan = int(cell.get("rowspan", 1))
            colspan = int(cell.get("colspan", 1))
            txt = clean_text(cell.get_text(" ", strip=True))
            
            for r in range(rowspan):
                for c in range(colspan):
                    grid[(r_idx + r, c_idx + c)] = txt
                    
            c_idx += colspan
            if c_idx > max_cols:
                max_cols = c_idx
                
    grid_list = []
    for r in range(len(rows)):
        row_list = []
        for c in range(max_cols):
            row_list.append(grid.get((r, c), ""))
        grid_list.append(row_list)
    return grid_list

def extract_courses(html_file: Path) -> pd.DataFrame:
    soup = BeautifulSoup(
        html_file.read_text(encoding="utf-8", errors="ignore"), "html.parser"
    )

    rows = []
    tables = soup.find_all("table")

    for table in tables:
        grid = table_to_grid(table)
        if not grid or len(grid) < 2:
            continue
            
        ma_idx, ten_idx, tc_idx = None, None, None
        
        current_type = "Môn học khác"
        for prev in table.find_all_previous(["h2", "h3", "h4", "h5", "strong", "b", "p"]):
            prev_text = key_text(prev.get_text(" ", strip=True))
            if len(prev_text) > 200:
                continue
            new_type = detect_type(prev_text, current_type)
            if new_type != current_type:
                current_type = new_type
                break

        for r in range(len(grid)):
            row_cells = grid[r]
            row_text_lower = [key_text(c) for c in row_cells]
            
            # 1. ĐỌC TIÊU ĐỀ ĐỘNG: Lấy Tên môn học làm mỏ neo thay vì Mã môn
            if any(any(k in c for k in ["ten mon", "ten mh", "ten hp", "course name", "module name", "module title", "ten hoc phan", "hoc phan", "tieng viet"]) for c in row_text_lower):
                ma_idx, ten_idx, tc_idx = None, None, None
                for c, cell_text in enumerate(row_text_lower):
                    if ma_idx is None and any(k in cell_text for k in ["ma mon", "ma mh", "ma hp", "course code", "module code", "ma hoc phan"]):
                        ma_idx = c
                    if ten_idx is None and any(k in cell_text for k in ["ten mon", "ten mh", "ten hp", "course name", "module name", "module title", "ten hoc phan", "hoc phan", "tieng viet"]):
                        ten_idx = c
                    if tc_idx is None and (cell_text == "tc" or cell_text.startswith("tc ") or any(k in cell_text for k in ["tin chi", "stc", "credit", "so tc", "cats"])):
                        tc_idx = c
                continue 
            
            non_empty = []
            for c in row_cells:
                if c.strip() and c.strip() not in non_empty:
                    non_empty.append(c.strip())
                    
            if len(non_empty) == 1:
                possible_new_type = detect_type(key_text(non_empty[0]), current_type)
                if possible_new_type != current_type:
                    current_type = possible_new_type
                continue
                
            # 3. Trích xuất môn học (Chỉ bắt buộc có Tên môn)
            if ten_idx is None:
                continue
                
            ma_mon = row_cells[ma_idx] if ma_idx is not None else ""
            ten_mon = row_cells[ten_idx]
            
            tc = ""
            if tc_idx is not None and tc_idx < len(row_cells):
                tc = row_cells[tc_idx]
            else:
                for c in range(ten_idx + 1, len(row_cells)):
                    if any(char.isdigit() for char in row_cells[c]):
                        tc = row_cells[c].strip()
                        break
                        
            if not ten_mon:
                continue
                
            if ma_mon and ma_mon == ten_mon:
                continue
                
            ten_mon_key = key_text(ten_mon)
            # Lọc các dòng tổng kết / rác
            if any(k in ten_mon_key for k in ["tong so", "total", "hoc phan tu chon", "cac hoc phan", "sinh vien"]):
                continue
            if ten_mon_key in ["stt", "so tin chi", "ma mon hoc", "ten mon hoc"]:
                continue

            rows.append({
                "Mã môn học": ma_mon,
                "Tên môn học": ten_mon,
                "TC": tc,
                "Loại môn học": current_type,
                "Độ khó": "",
            })

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.drop_duplicates(subset=["Mã môn học", "Tên môn học"], keep="first")
        df = df[["Mã môn học", "Tên môn học", "TC", "Loại môn học", "Độ khó"]]
        
    return df

if __name__ == "__main__":
    input_path_str = input("👉 Nhập đường dẫn file HTML: ").strip()
    html_file_path = Path(input_path_str)

    if not html_file_path.exists():
        print(f"❌ LỖI: Không tìm thấy file '{html_file_path}'.")
    else:
        output_name = input("👉 Nhập tên file lưu (KHÔNG CẦN gõ đuôi .csv): ").strip()
        print("\n⏳ Đang xử lý dữ liệu...")
        
        try:
            df = extract_courses(html_file_path)

            if df.empty:
                print("\n❌ LỖI: Thuật toán không tìm thấy bảng dữ liệu tương thích.")
            else:
                print("\n✅ KẾT QUẢ TRÍCH XUẤT (5 dòng đầu):")
                print(df.head())
                
                print("\n📊 THỐNG KÊ SỐ MÔN THEO LOẠI:")
                print(df["Loại môn học"].value_counts().to_string())
                
                csv_file = f"{output_name}.csv"
                excel_file = f"{output_name}.xlsx"
                
                df.to_csv(csv_file, index=False, encoding="utf-8-sig")
                df.to_excel(excel_file, index=False)
                
                print(f"\n🎉 THÀNH CÔNG! Đã bóc tách và lưu vào:")
                print(f"   - {csv_file}")
                print(f"   - {excel_file}")
                print("-" * 60)
            
        except Exception as e:
            print(f"\n❌ LỖI TRONG QUÁ TRÌNH XỬ LÝ: {e}")