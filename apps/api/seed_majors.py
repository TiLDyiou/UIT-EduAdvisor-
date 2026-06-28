import asyncio
from sqlalchemy.dialects.postgresql import insert
from app.db.models.core_security import Major
from app.db.session import init_engine, get_sessionmaker
from app.core.config import get_settings

majors_data = [
    ("ATTN", "Kỹ sư tài năng ngành An toàn Thông tin"),
    ("KHTN", "Cử nhân tài năng ngành Khoa học Máy tính"),
    ("ATBC", "Ngành Mạng máy tính và An toàn thông tin – Chương trình liên kết BCU"),
    ("ATCL", "Ngành An toàn Thông tin – Chương trình Chất lượng cao"),
    ("ATTT", "Ngành An toàn Thông tin"),
    ("CNCL", "Ngành Công nghệ Thông tin – Chương trình Chất lượng cao định hướng Nhật Bản"),
    ("CNTT", "Ngành Công nghệ Thông tin"),
    ("CTTT", "Ngành Hệ thống Thông tin – Chương trình tiên tiến"),
    ("HTCL", "Ngành Hệ thống Thông tin – Chương trình Chất lượng cao"),
    ("HTTT", "Ngành Hệ thống Thông tin"),
    ("KHBC", "Ngành Khoa học Máy tính – Chương trình liên kết BCU"),
    ("KHCL", "Ngành Khoa học Máy tính – Chương trình Chất lượng cao"),
    ("KHDL", "Ngành Khoa học Dữ liệu"),
    ("KHMT", "Ngành Khoa học Máy tính"),
    ("KHNT", "Ngành Khoa học Máy tính – Chuyên ngành Trí tuệ Nhân tạo"),
    ("KTMT", "Ngành Kỹ thuật Máy tính"),
    ("KTPM", "Ngành Kỹ thuật Phần mềm"),
    ("MMCL", "Ngành Mạng máy tính và truyền thông dữ liệu – Chương trình Chất lượng cao"),
    ("MMTT", "Ngành Mạng máy tính và truyền thông dữ liệu"),
    ("MTCL", "Ngành Kỹ thuật Máy tính – Chương trình Chất lượng cao"),
    ("MTIO", "Ngành Kỹ thuật Máy tính – Chuyên ngành Hệ thống nhúng và IoT"),
    ("PMCL", "Ngành Kỹ thuật Phần mềm – Chương trình Chất lượng cao"),
    ("TMCL", "Ngành Thương mại Điện tử – Chương trình Chất lượng cao"),
    ("TMĐT", "Ngành Thương mại Điện tử"),
    ("TTĐPT", "Truyền thông Đa phương tiện"),
]

async def main():
    init_engine(get_settings().database_url)
    maker = get_sessionmaker()
    
    async with maker() as session:
        stmt = insert(Major).values([
            {"code": code, "name": name} for code, name in majors_data
        ])
        stmt = stmt.on_conflict_do_update(
            index_elements=['code'],
            set_={'name': stmt.excluded.name}
        )
        await session.execute(stmt)
        await session.commit()
        print(f"Executed upsert for {len(majors_data)} majors")

if __name__ == "__main__":
    asyncio.run(main())
