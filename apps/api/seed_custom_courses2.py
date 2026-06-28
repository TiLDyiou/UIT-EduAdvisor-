import asyncio
import csv
import uuid
from io import StringIO
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from app.db.models.academic import Course
from app.db.session import init_engine, get_sessionmaker
from app.core.config import get_settings

csv_data = """SS003,Tư tưởng Hồ Chí Minh,2,Môn đại cương,Dễ
SS006,Pháp luật đại cương,2,Môn đại cương,Dễ
SS007,Triết học Mác – Lênin,3,Môn đại cương,Trung bình
SS008,Kinh tế chính trị Mác – Lênin,2,Môn đại cương,Trung bình
SS009,Chủ nghĩa xã hội khoa học,2,Môn đại cương,Trung bình
SS010,Lịch sử Đảng Cộng sản Việt Nam,2,Môn đại cương,Dễ
MA006,Giải tích,4,Môn đại cương,Trung bình
MA003,Đại số tuyến tính,3,Môn đại cương,Trung bình
MA004,Cấu trúc rời rạc,4,Môn đại cương,Dễ
MA005,Xác suất thống kê,3,Môn đại cương,Trung bình
PH002,Nhập môn mạch số,4,Môn đại cương,Dễ
IT001,Nhập môn Lập trình,4,Môn đại cương,Trung bình
ENG01,Anh văn 1,4,Môn đại cương,Dễ
ENG02,Anh văn 2,4,Môn đại cương,Dễ
ENG03,Anh văn 3,4,Môn đại cương,Dễ
ME001,Giáo dục Quốc phòng,Tính riêng,Môn đại cương,Dễ
PE231,Giáo dục thể chất 1,Tính riêng,Môn đại cương,Dễ
PE232,Giáo dục thể chất 2,Tính riêng,Môn đại cương,Dễ
IT002,Lập trình hướng đối tượng,4,Môn cơ sở ngành,Khó
IT003,Cấu trúc dữ liệu và giải thuật,4,Môn cơ sở ngành,Khó
IT004,Cơ sở dữ liệu,4,Môn cơ sở ngành,Dễ
IT005,Nhập môn mạng máy tính,4,Môn cơ sở ngành,Dễ
IT006,Kiến trúc máy tính,3,Môn cơ sở ngành,Trung bình
IT007,Hệ điều hành,4,Môn cơ sở ngành,Dễ
NT015,Giới thiệu ngành ATTT,1,Môn cơ sở ngành,Dễ
NT106,Lập trình mạng căn bản,3,Môn cơ sở ngành,Trung bình
NT140,An toàn mạng,4,Môn cơ sở ngành,Khó
NT230,Cơ chế hoạt động của mã độc,3,Môn cơ sở ngành,Khó
NT132,Quản trị mạng và hệ thống,4,Môn cơ sở ngành,Khó
NT219,Mật mã học,3,Môn cơ sở ngành,Khó
NT209,Lập trình hệ thống,3,Môn cơ sở ngành,Khó
NT208,Lập trình ứng dụng web,3,Môn cơ sở ngành,Trung bình
NT521,Lập trình an toàn và khai thác lỗ hổng phần mềm,4,Môn cơ sở ngành,Khó
NT204,"Hệ thống tìm kiếm, phát hiện và ngăn ngừa xâm nhập",3,Môn chuyên ngành,Khó
NT330,An toàn mạng không dây và di động,3,Môn chuyên ngành,Khó
NT207,Quản lý rủi ro và an toàn thông tin trong doanh nghiệp,3,Môn chuyên ngành,Khó
NT137,Kỹ thuật phân tích mã độc,3,Môn chuyên ngành,Khó
NT213,Bảo mật web và ứng dụng,3,Môn chuyên ngành,Khó
NT334,Pháp chứng kỹ thuật số,3,Môn chuyên ngành,Khó
NT535,Bảo mật Internet of things,3,Môn chuyên ngành,Khó
NT211,"An ninh nhân sự, định danh và chứng thực",3,Môn chuyên ngành,Khó
NT212,"An toàn dữ liệu, khôi phục thông tin sau sự cố",3,Môn chuyên ngành,Khó
NT534,An toàn mạng máy tính nâng cao,3,Môn chuyên ngành,Khó
NT133,An toàn kiến trúc hệ thống,3,Môn chuyên ngành,Khó
NT523,An toàn thông tin trong kỷ nguyên Máy tính lượng tử,3,Môn chuyên ngành,Khó
NT205,Tấn công mạng,3,Môn chuyên ngành,Khó
NT547,"Blockchain: nền tảng, ứng dụng và bảo mật",3,Môn chuyên ngành,Khó
NT118,Phát triển ứng dụng trên thiết bị di động,3,Môn chuyên ngành,Khó
NT522,Phương pháp học máy trong an toàn thông tin,3,Môn chuyên ngành,Khó
SS004,Kỹ năng nghề nghiệp,2,Môn học khác,Dễ
,Tự chọn tự do 1,,Môn tự do,
,Tự chọn tự do 2,,Môn tự do,
NT114,Đồ án chuyên ngành,2,"Đồ án, thực tập",
NT215,Thực tập doanh nghiệp,2,"Đồ án, thực tập",
NT505,Khóa luận tốt nghiệp,10,"Đồ án, thực tập",
NT506,Đồ án tốt nghiệp tại doanh nghiệp,10,"Đồ án, thực tập",
NT508,Đồ án tốt nghiệp,6,"Đồ án, thực tập",
,Chuyên đề tốt nghiệp tự chọn,,"Đồ án, thực tập",
NT541,Công nghệ mạng khả lập trình,4,"Đồ án, thực tập",Khó
NT548,Công nghệ DevOps và ứng dụng,4,"Đồ án, thực tập",Khó"""

KIND_MAP = {
    "Môn đại cương": "dai_cuong",
    "Môn cơ sở ngành": "co_so_nganh",
    "Môn chuyên ngành": "chuyen_nganh",
    "Môn học tự chọn": "tu_do",
    "Môn tự do": "tu_do",
    "Đồ án, thực tập": "do_an",
    "Môn học khác": "dai_cuong",
}

DIFFICULTY_MAP = {
    "dễ": "easy",
    "trung bình": "medium",
    "khó": "hard",
}

async def main():
    init_engine(get_settings().database_url)
    maker = get_sessionmaker()
    
    courses_with_code = []
    courses_without_code = []
    
    # parse CSV
    reader = csv.reader(StringIO(csv_data))
    
    seen = set()
    for row in reader:
        if not row or len(row) < 4:
            continue
            
        code = row[0].strip()
        name = row[1].strip()
        tc = row[2].strip()
        kind_raw = row[3].strip()
        
        difficulty_raw = None
        if len(row) >= 5:
            difficulty_raw = row[4].strip() or None
            
        if not code:
            # Generate a pseudo-code because DB requires NOT NULL
            # Example: name='Tự chọn tự do 1' -> 'PH-TU-CHON-...'
            code = "PH_" + uuid.uuid4().hex[:8].upper()
            
        # Deduplicate within this batch
        key = code if code else name
        if key in seen:
            continue
        seen.add(key)
            
        # parse credits
        try:
            credits = int(tc)
        except ValueError:
            credits = 0
        if not tc:
            credits = 0
            
        kind = KIND_MAP.get(kind_raw, "tu_do")
        
        difficulty = None
        if difficulty_raw:
            difficulty = DIFFICULTY_MAP.get(difficulty_raw.lower())
        
        c_dict = {
            "code": code,
            "name": name,
            "credits": credits,
            "kind": kind,
            "difficulty": difficulty,
        }
        
        if code:
            courses_with_code.append(c_dict)
        else:
            courses_without_code.append(c_dict)
            
    async with maker() as session:
        # All courses now have a code, so we upsert everything in one batch
        if courses_with_code:
            stmt = insert(Course).values(courses_with_code)
            stmt = stmt.on_conflict_do_update(
                index_elements=['code'],
                set_={
                    'name': stmt.excluded.name,
                    'credits': stmt.excluded.credits,
                    'kind': stmt.excluded.kind,
                    'difficulty': stmt.excluded.difficulty,
                }
            )
            await session.execute(stmt)
            
        await session.commit()
        print(f"Executed upsert for {len(courses_with_code)} courses")

if __name__ == "__main__":
    asyncio.run(main())
