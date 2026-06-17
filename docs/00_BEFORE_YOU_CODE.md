# BẮT BUỘC ĐỌC TRƯỚC KHI CODE (Project Onboarding & Codebase Review)

Ngày cập nhật: 2026-06-05

Tài liệu này tổng hợp toàn bộ tình trạng hiện tại của dự án **UIT EduAdvisor** và những lưu ý cốt lõi bạn bắt buộc phải biết trước khi viết bất kỳ dòng code nào.

Nó kết hợp các thông tin từ `README.md`, `codebase_review.md`, PRD (`UIT_EduAdvisor_PRD_v3.md`), và lộ trình dự án (`production_roadmap_80636c8e.plan.md`). Hãy đọc kỹ để tránh phá vỡ kiến trúc, gây rủi ro bảo mật hoặc làm sai lệch logic sản phẩm.

---

## 1. Tóm tắt Tiến độ Hiện tại (Trạng thái Codebase)

Mặc dù `README.md` hiện tại có thể đang ghi chú dự án ở mốc **M2 (Onboarding)**, thực tế codebase đã đi xa hơn và bao phủ nhiều phần của **M3 đến M7**.

**Các phân hệ đã có khung (nhưng chưa hoàn thiện 100%):**

- **Web (Sinh viên):** Trang chủ, Onboarding, Academic Tracker (Roadmap & GPA Tools), Scheduler (Xếp lịch học), AI Mate (Chatbot tư vấn), Settings (Cài đặt).
- **Web (Admin):** Admin dashboard quản lý môn học, chương trình đào tạo, tài liệu, tooltip, quy chế, import dữ liệu, job, và audit log.
- **Backend (API):** Các endpoint xử lý nghiệp vụ cho Sinh viên, Admin, Tracker, Scheduler, AI Mate, Bot, và đồng bộ dữ liệu (DAA/Moodle).
- **Hạ tầng (Infra):** Chạy cục bộ bằng Docker Compose bao gồm Postgres (+pgvector), Redis, Vault, API (FastAPI), Web (Next.js).

**Vấn đề chính:** Khung sườn đã có, nhưng nhiều tính năng đang bị "rỗng ruột" hoặc chưa đáp ứng đủ yêu cầu UX/UI chuẩn mực được ghi trong PRD. Bạn cần tập trung vào việc **sửa chữa và làm đúng logic sản phẩm** hơn là thêm tính năng mới ồ ạt.

---

## 2. Kiến trúc & Công nghệ (Tech Stack)

Dự án là một **Monorepo** với các thành phần chính:

- `apps/web`: **Next.js 15 (App Router)** cho Frontend.
- `apps/api`: **FastAPI (Python 3.12)** cho Backend xử lý.
- `infra`: Cấu hình Docker Compose.

**Luồng dữ liệu:**
Next.js (Web) ➔ FastAPI (Backend) ➔ Postgres (DB chính + pgvector cho AI RAG) / Redis (Session, Rate limit) / Vault (Mã hóa) ➔ DAA/Moodle/Gemini API.

---

## 3. Các Rủi Ro Kỹ Thuật BẮT BUỘC Phải Lưu Ý

### 3.1. Bảo mật & Quản lý Credential (RẤT QUAN TRỌNG)

- **Cơ chế:** Dự án lưu MSSV và Mật khẩu của sinh viên (để tự động sync Moodle). Tuy nhiên, chúng **PHẢI được mã hóa bằng HashiCorp Vault (Transit Engine)** trước khi lưu vào Database.
- **Rủi ro hiện tại:** Vault trong Docker Compose đang chạy ở **Dev-mode** (tự động unseal, lưu in-memory). Khởi động lại (restart) sẽ làm mất Transit keys. Nghĩa là mật khẩu đã lưu có thể không thể giải mã được. **Cần lưu ý điểm này trước khi đưa lên môi trường Production.**
- **Bảo mật `.env`:** File `.env` chứa các bí mật thực sự, tuyệt đối không commit lên git.

### 3.2. Background Sync (Đồng bộ nền)

- Cơ chế đồng bộ dữ liệu DAA/Moodle đang chạy thẳng trong process của API (FastAPI).
- **Rủi ro:** Nếu container restart hoặc crash giữa chừng, quá trình đồng bộ (sync job) sẽ bị kẹt. Sinh viên sẽ bị kẹt ở trạng thái "đang đồng bộ". Tương lai cần chuyển sang Redis queue (worker).

### 3.3. Parser DAA/Moodle dễ vỡ

- Việc trích xuất dữ liệu dựa hoàn toàn vào cấu trúc HTML/JSON của trang DAA/Moodle.
- **Rủi ro:** Nếu trường UIT cập nhật giao diện, parser sẽ hỏng. **Tuyệt đối không sửa parser nếu không viết/chạy fixture test (test với HTML mẫu).**

---

## 4. Những Chỗ Lệch PRD & Cần Sửa Chữa (Ưu Tiên Công Việc)

Dưới đây là những lỗi logic và UX/UI cần được ưu tiên khắc phục trước khi code các phần khác:

### P0 - Ảnh hưởng nghiêm trọng (Must-Fix)

1. **Onboarding Consent:** Checkbox đồng ý điều khoản (Privacy/ToS) đang quá sơ sài. PRD yêu cầu người dùng **phải đọc và hiểu rõ** việc hệ thống lưu mật khẩu (dù đã mã hóa). Cần làm nổi bật link/nội dung.
2. **Settings mất dấu Tiếng Việt:** Trang Cài đặt hiện bị mất dấu tiếng Việt (ví dụ: "Cai dat", "Xoa"). Đây là trang nhạy cảm thao tác với dữ liệu, chữ mất dấu làm giảm độ tin cậy nghiêm trọng. **Phải sửa lại chuẩn tiếng Việt.**
3. **Scheduler Export `.ics` sai ngày:** Lịch xuất ra đang lấy ngày hiện tại làm ngày bắt đầu học kỳ thay vì giá trị thực tế/input của sinh viên.
4. **GPA Scale Disclaimer:** Thang điểm GPA dự báo cần có dòng cảnh báo (disclaimer) rõ ràng rằng "Kết quả chỉ mang tính tham khảo" vì chưa có bảng quy đổi chính thức được Admin phê duyệt.

### P1 - Lỗi UX và Logic Sản Phẩm

1. **Interactive Roadmap:**
   - Các node (môn học) trong Roadmap hiện chỉ hover được. PRD yêu cầu phải **click được để mở trang chi tiết môn**.
   - Các "nhóm môn tự chọn" cần được hiển thị thành một khung (container) bao bọc các môn bên trong, thay vì chỉ là các badge tổng hợp.
2. **Reverse Calculator:** Công cụ tính điểm chưa cho phép người dùng chọn mục tiêu theo thang 10 hay thang 4 (chưa có toggle).
3. **Retake Estimator:** Chưa tính toán chi phí học lại (số tiền sinh viên phải bỏ ra).
4. **AI Mate Privacy:** Nút "Kết thúc phiên" AI chưa có giải thích rõ cho người dùng là dữ liệu nào sẽ được lưu lại (summary) và vì sao cần bấm. AI Mate chưa chặn luồng nếu người dùng chưa onboarding (chưa có ngữ cảnh).

---

## 5. Nguyên Tắc & Checklist Trước / Trong Khi Code

Để đảm bảo chất lượng codebase, vui lòng tuân thủ:

1. **Simplicity First & Surgical Changes:**
   - Code đúng trọng tâm yêu cầu. KHÔNG tự ý refactor những phần không liên quan hoặc code chạy đang ổn định.
   - Code ngắn gọn, không viết trước các tính năng "phòng hờ" mà PRD chưa yêu cầu.

2. **Database Changes:** Bất kỳ thay đổi nào về model (SQLAlchemy) **BẮT BUỘC** phải sinh ra file migration tương ứng (`make revision m="..."`).

3. **Giao tiếp Dữ liệu Nhạy cảm:** Nếu thao tác với mật khẩu, session, data cá nhân ➔ Luôn kiểm tra CSRF, Session validation, Audit Log (với admin) và Rate limiting.

4. **UI/UX Consistency:**
   - Kiểm tra giao diện trên cả Desktop và Mobile.
   - Đảm bảo hiển thị đầy đủ các trạng thái: **Loading, Empty (chưa có dữ liệu), Error (lỗi)**.
   - Tuyệt đối không dùng tiếng Việt không dấu (đặc biệt trong các thông báo hệ thống hoặc UI quan trọng).

5. **Tránh Hard-code:** Nếu dữ liệu (như tooltip, quy chế) có phần admin quản lý, hãy lấy từ database/API, **không hard-code** nội dung đó thẳng vào Frontend.

---

> **BƯỚC TIẾP THEO:**
> Sau khi đọc xong tài liệu này, hãy mở `.cursor/plans` và `docs/codebase_review.md` để nắm các milestone chi tiết, sau đó bắt đầu chạy `make install`, `make up`, và `make migrate` để dựng môi trường cục bộ. Chúc bạn code tốt!
