**UIT EduAdvisor**

**PRODUCT REQUIREMENTS DOCUMENT**

# **1. TỔNG QUAN SẢN PHẨM**

## **1.1 Giới thiệu**

UIT EduAdvisor là nền tảng Web Application hỗ trợ học vụ "All-in-one"
dành riêng cho sinh viên Đại học Công nghệ Thông tin (UIT). Hệ thống
đóng vai trò như một cố vấn học tập thông qua công cụ trực quan, tính
toán tự động và tích hợp AI để tư vấn chiến lược học tập.

## **1.2 Mục tiêu cốt lõi**

- **Trực quan hóa dữ liệu:** Biến bảng điểm thành "Bản đồ lộ trình" sinh
  động - sinh viên nhìn thấy toàn cảnh 4 năm học.

- **Tối ưu hóa thời gian:** Giảm thời gian sắp xếp thời khóa biểu từ
  hàng giờ xuống vài giây nhờ thuật toán tự động.

- **Cá nhân hóa:** Trợ lý AI thấu hiểu ngữ cảnh điểm số từng cá nhân để
  đưa ra lời khuyên và chiến lược học tập phù hợp.

- **Truy cập từ xa:** Sinh viên có thể nhận thông báo và tra cứu TKB,
  lịch thi qua Telegram, Discord Bot và Messenger mà không cần mở trình
  duyệt.

## **1.3 Tech Stack**

| **Layer**           | **Technology**                                                        | **Lý do chọn**                                          |
|---------------------|-----------------------------------------------------------------------|---------------------------------------------------------|
| Frontend            | Next.js (React)                                                       | Tối ưu SEO, server-side rendering, routing linh hoạt    |
| Backend             | FastAPI (Python)                                                      | Xử lý tính toán khoa học dữ liệu, HTML/cookie parser    |
| Database            | PostgreSQL + pgvector                                                 | Dữ liệu quan hệ + lưu vector embedding cho RAG          |
| AI Model            | Google Gemini 1.5 Flash                                               | Hiệu năng cao, chi phí thấp, hỗ trợ streaming           |
| Bot                 | python-telegram-bot + discord.py + Meta Graph API (Facebook Webhooks) | Thư viện trưởng thành, cộng đồng lớn                    |
| Local Storage       | IndexedDB (browser)                                                   | Lưu lịch sử chat offline, dung lượng lớn, non-blocking  |


# **2. PHÂN TÍCH NGƯỜI DÙNG**

| **Đối tượng**             | **Pain Points**                                                                | **Nhu cầu chức năng**                                                  |
|---------------------------|--------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Sinh viên Năm 1-2         | Mơ hồ về quy chế, đăng ký môn theo phong trào, chưa hình dung lộ trình dài hạn | Roadmap trực quan, Smart Tooltip tra cứu thuật ngữ nhanh               |
| Sinh viên Năm 3-4         | Cần tối ưu GPA để ra trường loại Giỏi, cần lịch học gọn để đi làm thêm         | GPA Simulator, Smart-Scheduler né giờ làm                              |
| Sinh viên Cảnh báo học vụ | Stress, nợ môn nhiều, không biết bắt đầu gỡ từ đâu                             | AI tư vấn lộ trình gỡ nợ môn, gợi ý môn trả nợ, lộ trình ra trường tối thiểu |
| Admin (Quản trị viên)     | Cần cập nhật quy chế, tài liệu, CTĐT mới cho sinh viên                         | Dashboard CRUD môn học, quy chế, tài liệu, CTĐT                        |

# **3. CHỨC NĂNG CHI TIẾT**

## **3.1 Phân hệ 1: Quản lý Lộ trình & Điểm số (Academic Tracker)**

### **3.1.1 Cơ chế Xác thực - Cookie-based Delegated Scraping**

Tổng quan: Hệ thống tiếp nhận MSSV + Mật khẩu, mã hóa bằng FLE (Vault
Transit Engine) và lưu vào DB để phục vụ sync tự động Moodle. DAA yêu
cầu giải captcha ảnh mỗi lần sync - chỉ chạy on-demand khi SV chủ động
bấm. Moodle sync hoàn toàn tự động theo lịch.

**Bước 0 - Consent Flow (BẮT BUỘC trước First-time Setup):**

Trước khi nhập credential, SV phải đọc và tick đồng ý Privacy Policy +
Terms of Service. Nội dung phải ghi rõ tối thiểu:

- "App sẽ lưu MSSV + MK của bạn dưới dạng đã mã hóa để phục vụ tự động
  đồng bộ Moodle."
- "Bạn có thể xóa MK và toàn bộ dữ liệu bất cứ lúc nào tại Settings."
- Link đến trang Privacy Policy đầy đủ.

Không tick -> không cho phép submit form đăng ký.

**Luồng xác thực lần đầu (First-time Setup):**

- Bước 1: Sinh viên nhập MSSV + Mật khẩu.

- Bước 2: Backend gọi DAA login page -> lấy captcha image trả về
  Frontend.

- Bước 3: Sinh viên nhìn ảnh captcha và nhập đáp án (có nút "Tải lại
  captcha" nếu ảnh khó đọc).

- Bước 4: Backend submit login DAA (MSSV + Password + captcha) -> crawl
  dữ liệu -> hủy session cookie.

- Bước 5: Backend tự động submit login Moodle (không cần captcha) ->
  crawl dữ liệu -> hủy session cookie.

- Bước 6: MSSV + Password được mã hóa bằng Vault Transit Engine -> lưu
  ciphertext vào PostgreSQL.

- Bước 7: Cấp app session cho sinh viên.

**Hai luồng đồng bộ tách biệt:**

**Luồng A - Đồng bộ DAA (On-demand only):**

- KHÔNG tự động - vì DAA yêu cầu giải captcha.
- Sinh viên chủ động bấm "Cập nhật điểm" -> app hiện captcha mới.
- SV giải captcha -> backend decrypt MK -> submit DAA -> crawl điểm + TKB
  + lịch thi.
- Cookie session DAA chỉ tồn tại trong RAM của 1 request crawl, xóa
  ngay sau khi crawl xong.
- **Không yêu cầu nhập lại password.**

**Luồng B - Đồng bộ Moodle (Tự động + On-demand):**

- Cron job chạy mỗi 18h: backend dùng MK đã lưu -> login Moodle (không
  captcha) -> crawl deadline + tài liệu mới.
- SV cũng có thể bấm "Cập nhật Moodle" để sync ngay.
**Kết luận:**

- DAA: login + crawl HTML page + parse bảng.
- Moodle: login + gọi internal AJAX API + parse JSON, fallback parse HTML nếu cần.

**Cam kết bảo mật (Privacy Contract) - minh bạch:**

- Cookie session chỉ tồn tại trong RAM của 1 request crawl, được xóa
  ngay sau khi crawl xong.

- **MK encrypted (FLE) VẪN lưu DB** để phục vụ auto-sync Moodle - đây
  là điều kiện đánh đổi để có tự động hóa.

- Sau crawl xong, cookie và plaintext credential bị null và xóa khỏi
  memory.

- Chỉ lưu data đã được extract và chuẩn hóa.

- Sinh viên có quyền xóa toàn bộ dữ liệu (kể cả MK encrypted) bất cứ
  lúc nào.

- Dữ liệu nhạy cảm khi lưu vào DB đều đã được mã hóa (FLE).

**Dữ liệu crawl từ DAA:**

- MSSV, Họ tên, Ngành học, Năm nhập học

- Danh sách môn học: Mã môn, Tên môn, Số tín chỉ, Điểm, Trạng thái

- GPA tích lũy hiện tại

- TKB

- Lịch thi

**Dữ liệu crawl từ Moodle:**

- Tài liệu giảng viên gửi (nếu có)

- Deadline bài tập

### **3.1.2 Interactive Roadmap Tree**

Sơ đồ dạng cây thể hiện mối quan hệ tiên quyết giữa các môn học. Mỗi
node là một môn học, màu sắc phản ánh trạng thái học tập.

**Mã màu:**

| **Màu** | **Trạng thái**         | **Tương tác**                                                    |
|---------|------------------------|------------------------------------------------------------------|
| Xanh lá | Đã qua                 | Hover -> xem điểm chi tiết                                        |
| Vàng    | Đang học (kỳ hiện tại) | Hover -> xem các cột điểm đã có và thông báo nhanh các deadlines. |
| Đỏ      | Rớt - cần học lại      | Hover -> cảnh báo + gợi ý học lại                                 |
| Xám     | Chưa học / Bị khóa     | Hover -> xem điều kiện tiên quyết còn thiếu                       |

- Click vào node -> chuyển đến trang chi tiết môn học (tài liệu, quy chế
  liên quan).

- Hiệu ứng gamification: phủ xanh node khi hoàn thành môn, tạo cảm giác
  tiến độ.

**Edge case - Sinh viên Năm 1 (chưa có dữ liệu điểm):**

Khi SV chưa có dữ liệu điểm (mới nhập học hoặc chưa sync), Roadmap hiển
thị **"Preview mode"** dựa trên CTĐT mẫu của ngành - toàn bộ node màu
xám với label "(chưa học)". SV vẫn xem được toàn cảnh lộ trình 4 năm
trước khi sync lần đầu.

### **3.1.3 Bộ công cụ tính toán GPA (GPA Suite)**

UIT hiển thị cả thang điểm 10 và thang 4. GPA Suite tính song song cả 2,
hiển thị mặc định **thang 10** (vì là thang dùng để xét loại tốt
nghiệp).

> Lưu ý: Bảng quy đổi cần admin xác nhận lại đúng theo Quy chế UIT hiện
> hành trước khi đưa vào production.

**GPA Simulator (Dự báo):**

- Nhập điểm giả định cho các môn đang học (màu Vàng).

- GPA tích lũy dự kiến cập nhật realtime - không cần bấm nút.

- Hiển thị song song cả thang 10 và thang 4. Mặc định thang 10.

**Reverse Calculator (Tính ngược):**

- Nhập mục tiêu GPA. Có toggle chọn thang điểm input: 10 hoặc 4.

- Hệ thống tính điểm trung bình cần đạt cho tín chỉ còn lại để đạt mục
  tiêu.

**Retake Estimator (Học cải thiện):**

- Chọn môn điểm thấp -> Hệ thống tính mức tăng GPA nếu học lại với điểm
  giả định mới.

- Tính chi phí học lại.

## **3.2 Phân hệ 2: UIT Scheduler (Xếp lịch & Gợi ý Môn)**

### **3.2.1 Gợi ý Môn học (Smart Recommendation)**

Input: Bảng điểm hiện tại của sinh viên + File Excel TKB dự kiến từ
trường (do sinh viên upload).

**Thuật toán Scoring:**

> score = 0  
> + 5 nếu là môn chuyên ngành  
> + 2 nếu là môn sở trường (môn tiếp theo của môn có grade >= 8.0)  
> - 3 nếu môn được gán nhãn 'Khó' VÀ cumulative_gpa <= 2.5  
> + 2 nếu là môn đại cương chưa hoàn thành  
> + 3 nếu môn nằm trong elective_group mà SV chưa thỏa N tín chỉ tối thiểu của nhóm  
>   
> -> Các tiêu chí CỘNG DỒN (không loại trừ nhau)  
> -> **Sort DESC by score -> Lấy top 5 + Danh sách các môn đại cương chưa hoàn thành.**  
> -> Tie-break (cùng score): ưu tiên hiển thị môn có độ khó thấp hơn hoặc ít tín chỉ hơn hoặc nằm ở kì nhỏ hơn theo CTĐT.  
> -> Môn có score âm VẪN xuất hiện trong danh sách.  
> Nguồn dữ liệu lọc: 3 học kỳ tiếp theo trong CTĐT mẫu.  
> Điều kiện: môn đó đang được mở ở kỳ tiếp theo (theo file Excel).

**Hỗ trợ Elective Groups (môn tự chọn):**

- Khi tính điểm, ưu tiên các môn nằm trong nhóm tự chọn mà SV chưa hoàn
  thành đủ ràng buộc nhóm (xem 3.5.4).
- Khi render, các môn trong cùng 1 elective_group được gom thành cụm
  trong UI gợi ý, kèm tag "Nhóm tự chọn: <tên nhóm> - còn thiếu N tín
  chỉ".

### **3.2.2 Xếp lịch Tự động (Smart-Scheduler)**

- Input: Danh sách mã môn muốn đăng ký + Tick chọn các buổi có thể học
  trong tuần.

- Thuật toán: CSP (Constraint Satisfaction Problem) hoặc Backtracking -
  chạy trên backend FastAPI.

- Output: 3 phương án TKB thỏa mãn nhiều điều kiện nhất, hiển thị dạng
  lưới tuần.

- Thời gian xử lý: < 7 giây với không gian mẫu ~1.000 tổ hợp.


### **3.2.3 Xuất lịch & Đồng bộ**

- Xuất phương án đã chọn ra file `.ics`.

- Hỗ trợ import trực tiếp vào Google Calendar / Apple Calendar.

- **Stable UID:** Mỗi event xuất ra `.ics` có `UID = hash(student_id +
  course_code + week_start)` để khi re-import vào Google Calendar không
  tạo duplicate event (cùng môn, cùng tuần -> cùng UID -> calendar tự
  update thay vì thêm mới).

## **3.3 Phân hệ 3: Trợ lý AI "UIT Mate"**

UIT Mate là trợ lý AI tư vấn học vụ với giọng điệu thân thiện. Phạm vi
hỗ trợ: tra cứu quy chế, tư vấn lộ trình học, gợi ý chiến lược cải
thiện GPA, giải đáp thuật ngữ.

**Disclaimer bắt buộc:** Mọi câu trả lời của AI Mate liên quan đến quy
chế phải hiển thị footer mờ:

> "Thông tin tham khảo. Vui lòng kiểm tra lại với Phòng Đào tạo trước
> khi ra quyết định quan trọng."

### **3.3.1 Cơ chế Context Injection + RAG**

**Context Injection - 2 lớp:**

> Lớp 1 - Real-time context (mỗi request):  
> {  
> &nbsp;&nbsp;student_name, major, year, cumulative_gpa,  
> &nbsp;&nbsp;current_courses, failed_courses,  
> &nbsp;&nbsp;upcoming_exams (từ Moodle)  
> }  
>   
> Lớp 2 - Historical context (từ AI summary lưu server):  
> {  
> &nbsp;&nbsp;courses_of_interest: string[],   // các môn đang quan tâm  
> &nbsp;&nbsp;recent_questions: string[]       // tóm tắt câu hỏi gần đây  
> }

**RAG (Retrieval-Augmented Generation):**

- Truy xuất dữ liệu từ Vector DB (pgvector) chứa Quy chế đào tạo, Sổ tay
  sinh viên.

- Mặc định lọc `is_deprecated = false` (xem 3.5.3).

- Ưu tiên văn bản quy chế mới nhất khi có nhiều phiên bản.

### **3.3.2 Lưu trữ Lịch sử Chat (Hybrid Storage)**

**3 tầng lưu trữ:**

| **Tầng**      | **Nơi lưu**         | **Nội dung**                                                 | **Thời gian giữ** |
|---------------|---------------------|--------------------------------------------------------------|-------------------|
| 1 - In-memory | RAM (browser)       | Toàn bộ tin nhắn phiên hiện tại - dùng cho AI context window | Đến khi đóng tab  |
| 2 - Local     | IndexedDB (browser) | Toàn bộ lịch sử chat của user                                | 30 ngày gần nhất  |
| 3 - Server    | PostgreSQL          | Pinned messages + AI-generated session summary               | 90 ngày           |

**AI-generated Session Summary (lưu server sau mỗi phiên):**

> {  
> &nbsp;&nbsp;courses_of_interest: string[],  
> &nbsp;&nbsp;recent_questions: string[]  
> }

> Summary KHÔNG chứa nội dung tin nhắn nguyên văn - chỉ là bản tóm tắt
> ngữ nghĩa do AI sinh ra.

**Tại sao dùng IndexedDB (không phải localStorage):**

- Dung lượng lớn (~50% ổ đĩa) - không giới hạn như localStorage (~5MB).

- Non-blocking (bất đồng bộ) - không ảnh hưởng performance UI.

- Có thể query theo index (VD: lấy chat theo ngày).

**Data Retention & User Control:**

- Local: tự động xóa chat > 30 ngày. **Mỗi lần app khởi động, frontend
  chạy 1 background task quét IndexedDB -> xóa các tin nhắn `created_at
  < now - 30 ngày`.**

- Server: giữ metadata 90 ngày, sau đó xóa tự động.

- SV có quyền **xem** danh sách AI summary đã lưu và **xóa** các bản
  summary này tại Settings.

- Nút "Xóa toàn bộ lịch sử" -> xóa cả local lẫn server, có confirmation
  dialog.

## **3.4 Phân hệ 4: Tra cứu thông minh (Smart Tooltip)**

Hệ thống tự động nhận diện thuật ngữ chuyên ngành trên giao diện. Sinh
viên hover chuột vào từ khóa (VD: "Cảnh báo học vụ", "Tiên quyết",
"GPA") -> hiện popup giải thích ngắn gọn kèm link quy chế liên quan.

- Danh sách thuật ngữ được admin quản lý, có thể cập nhật không cần
  deploy lại.

- Tooltip hiện trong < 200ms sau hover.

## **3.5 Phân hệ 5: Admin Dashboard**

### **3.5.0 Xác thực Admin (Admin Auth)**

- **Single-admin v1:** Một tài khoản admin duy nhất.

- Đăng nhập bằng **email + mật khẩu**.

- Password lưu dạng **bcrypt hash** (không phải FLE - vì admin password
  không cần re-use, chỉ cần verify).

- Session admin **tách biệt** với session SV (cookie path khác, hoặc
  subdomain `admin.*`).

- Mọi thao tác cấu hình quan trọng (xóa văn bản, xóa môn, chỉnh CTĐT)
  -> ghi log vào bảng `admin_audit_log` (timestamp + action + target_id).

### **3.5.1 Quản lý Môn học (Course Management)**

- CRUD đầy đủ: Mã môn, Tên môn, Số tín chỉ, Loại (Đại cương / Chuyên
  ngành / Tự chọn).

- Quản lý quan hệ Tiên quyết: Thêm/xóa môn tiên quyết (graph editor đơn
  giản).

- Gán nhãn Độ khó: Khó / Trung bình / Dễ - dùng cho thuật toán scoring ở
  3.2.1.

- Có thể upload file Excel lịch thi, Excel danh sách môn đăng kí của kì
  sau để hạn chế việc sinh viên phải sync dữ liệu từ DAA (điều này cần
  Admin phải cập nhật thường xuyên).

- Quản lý thuật ngữ Tooltip (3.4): Thêm/sửa/xóa từ khóa và nội dung giải
  thích.


### **3.5.2 Quản lý Tài liệu học tập (Resource Management)**

- Cho từng môn học: nhập link Google Drive (Slide, Đề thi cũ, Tài liệu
  tham khảo).

- Gán nhãn loại tài liệu: Slide / Đề thi / Tài liệu đọc thêm.

- Gán học kỳ áp dụng cho mỗi tài liệu -> sinh viên thấy đúng đề của đúng
  kỳ.

- Ẩn/hiện tài liệu mà không cần xóa.

### **3.5.3 Quản lý Quy chế & Văn bản (Policy Management)**

- Upload file PDF/DOCX quy chế -> hệ thống tự động Embedding vào Vector
  DB (pgvector).

- Quản lý version: mỗi văn bản có năm áp dụng - RAG ưu tiên bản mới nhất
  nhưng giữ bản cũ.

- Gán tag: Quy chế học vụ / Sổ tay SV / Quy định thi cử -> AI tìm đúng
  nguồn khi cần.

**Re-embedding & Deprecation:**

- Khi upload version mới của 1 văn bản quy chế -> embedding cũ được đánh
  dấu `is_deprecated = true` thay vì xóa.

- RAG query mặc định lọc `is_deprecated = false`.

- Admin có nút **"Khôi phục version cũ"** (cho trường hợp version mới
  sai sót) - bật lại `is_deprecated = false` cho version cũ và set
  `true` cho version mới.


### **3.5.4 Quản lý Chương trình đào tạo (Curriculum Management)**

Dữ liệu này là nguồn cho thuật toán gợi ý môn (3.2.1) - admin cần
maintain khi trường cập nhật CTĐT.

- CRUD lộ trình học kỳ chuẩn theo từng ngành (CNTT, KHMT, MMT,
  KTPM,...).

- Gán môn vào từng kỳ học theo lộ trình mẫu.

- Đánh dấu môn Bắt buộc / Tự chọn trong từng kỳ.

**Mở rộng data model - Elective Groups:**

- Mỗi môn có thuộc tính `elective_group_id` (nullable).

- Mỗi `elective_group` có ràng buộc:
  - Loại 1: "phải hoàn thành ít nhất N tín chỉ trong nhóm", hoặc
  - Loại 2: "chọn ít nhất K môn trong nhóm".

- Roadmap render nhóm tự chọn dạng **container nhóm** (nhiều môn nằm
  trong khung gộp với label nhóm), thay vì từng node rời rạc.

- Smart Recommendation (3.2.1) ưu tiên môn trong nhóm SV chưa thỏa ràng
  buộc.


## **3.6 Phân hệ 6: Remote Bot (Telegram & Discord & Messenger)**

### **3.6.1 Kiến trúc**

Một Unified Bot Gateway (FastAPI endpoint) tiếp nhận webhook từ cả
Telegram, Discord và Messenger (Facebook) chuẩn hóa về format chung, rồi
gọi vào backend hiện tại. Thiết kế này cho phép thêm nền tảng mới mà
không đụng vào business logic.

> [Telegram Bot]   [Discord Bot]   [FB Webhooks]  
> &nbsp;&nbsp;&nbsp;&nbsp;\\&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;/  
> &nbsp;&nbsp;&nbsp;&nbsp;[Unified Bot Gateway] <- FastAPI endpoint  
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|  
> &nbsp;&nbsp;&nbsp;&nbsp;[Backend Business Logic]  
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|  
> &nbsp;&nbsp;&nbsp;&nbsp;[PostgreSQL]

### **3.6.2 Identity Linking - Liên kết tài khoản**

Mọi lệnh đều yêu cầu tài khoản đã được liên kết. Chưa liên kết -> bot chỉ
trả về hướng dẫn link.

**Luồng liên kết một lần (One-time Linking):**

1.  Sinh viên vào Web App -> Settings -> "Kết nối Telegram" / "Kết nối
    Discord" / "Kết nối Messenger".

2.  App sinh ra `link_token` (UUID, hết hạn sau 10 phút).

3.  - **Telegram:** SV click link mở bot -> gửi `/start {link_token}`.
    - **Discord:** SV dùng lệnh `/link {link_token}`.
    - **Messenger:** SV click link dạng
      `m.me/<PAGE_NAME>?ref={link_token}`. Webhook của backend bắt event
      `messaging_optins` hoặc `messages` chứa payload `ref` để map tài
      khoản.

4.  Backend map `platform_user_id ↔ student_id`, lưu vào DB.

5.  Sau đó mọi message từ `platform_user_id` đó đều biết là sinh viên
    nào - không cần auth lại.

**Unlink / Re-link:**

- SV vào Web App -> Settings -> **"Hủy liên kết Telegram / Discord /
  Messenger"**.

- Khi hủy -> backend xóa mapping `platform_user_id ↔ student_id`.

- SV có thể tạo `link_token` mới để liên kết lại sau (kể cả với
  platform_user_id mới khác).

### **3.6.3 Danh sách Lệnh Bot**

| **Lệnh**                  | **Mô tả**                                            | **Yêu cầu Linked** |
|---------------------------|------------------------------------------------------|--------------------|
| `/start`                  | Hiện hướng dẫn liên kết tài khoản                    | Không              |
| `/tkb`                    | TKB tuần hiện tại                                    | Có                 |
| `/tkb [thứ]`              | TKB ngày cụ thể (VD: `/tkb thu4`)                    | Có                 |
| `/lithi`                  | Lịch thi sắp tới (7 ngày tới)                        | Có                 |
| `/deadline`               | Deadline bài tập sắp tới                             | Có                 |
| `/gpa`                    | GPA tích lũy hiện tại                                | Có                 |
| `/nhacnho thi on\|off`    | Bật/tắt nhắc lịch thi                                | Có                 |
| `/nhacnho deadline on\|off` | Bật/tắt nhắc deadline bài tập                      | Có                 |
| `/nhacnho status`         | Xem trạng thái bật/tắt hiện tại của 2 loại nhắc nhở  | Có                 |
| `/help`                   | Danh sách lệnh                                       | Không              |

**Menu cố định theo nền tảng:**

- **Telegram:** Sử dụng `setMyCommands` + `ReplyKeyboardMarkup` cho menu
  cố định (Xem TKB, Lịch thi, Deadline, GPA).

- **Discord:** Đăng ký **Slash Commands** qua Discord API (sẽ tự
  autocomplete trong client).

- **Messenger:** Cấu hình **Persistent Menu** qua Meta Graph API - menu
  cố định dưới góc chat (Xem TKB, Lịch thi, Deadline).

> Không hỗ trợ trên bot: Chat với AI Mate, upload dữ liệu, xếp lịch tự
> động - các tính năng này chỉ có trên Web App.


**Ưu tiên triển khai:**

- Phase 1:Facebook Messenger (yêu cầu Facebook App Review - overhead
  lớn hơn).

- Phase 2: Discord (discord.py - phổ biến trong cộng đồng sinh viên IT).

- Phase 3:Telegram (python-telegram-bot - đơn giản nhất, sinh viên IT
  quen dùng).

# **4. LUỒNG DỮ LIỆU & KIẾN TRÚC**

## **4.1 Write Flow - Khi Sync dữ liệu**

> Sinh viên cung cấp Thông tin đăng nhập gồm MSSV + Mật khẩu (DAA + Moodle)  
> -> Crawler (FastAPI, in-memory only)  
> -> Parser Engine trích xuất & chuẩn hóa dữ liệu  
> -> Cookie session bị hủy ngay sau crawl  
> -> Upsert vào PostgreSQL  
> -> MK encrypted (FLE) lưu DB phục vụ auto-sync Moodle  
> -> Cấp app session cho sinh viên

## **4.2 Read Flow - Khi Sử dụng**

> Frontend request -> FastAPI  
> -> PostgreSQL trả dữ liệu thô  
> -> Roadmap Engine: xử lý trạng thái cây môn học  
> -> Scheduler Engine: chạy thuật toán CSP/Backtracking  
> -> AI Controller: inject context -> Gemini API -> stream response  
> -> Bot Gateway: xử lý lệnh từ Telegram/Discord/Messenger  
> -> Kết quả trả về Frontend / Bot

# **5. YÊU CẦU PHI CHỨC NĂNG**

## **5.1 Bảo mật & Riêng tư**

- **Cookie-only-in-RAM:** cookie session DAA/Moodle chỉ tồn tại trong
  RAM của 1 request crawl, xóa ngay sau khi crawl xong.

- **MK lưu DB (minh bạch):** MSSV + MK của SV được mã hóa FLE và lưu DB
  để phục vụ auto-sync Moodle. Không phải mọi thứ đều "không lưu" - đây
  là điều kiện đánh đổi để có tự động hóa.

- **Data Control:** sinh viên có quyền xóa MK + toàn bộ dữ liệu bất cứ
  lúc nào.

- **DB Encryption:** dữ liệu nhạy cảm trong PostgreSQL được mã hóa
  at-rest (FLE).

- **Chat Privacy:** Nội dung chat thô **KHÔNG lưu server**. Server chỉ
  lưu (1) tin nhắn được pin, (2) bản tóm tắt do AI tạo từ phiên chat -
  **không chứa nội dung tin nhắn nguyên văn**. SV có quyền xem và xóa
  các bản tóm tắt này.

## **5.2 Hiệu năng**

| **Tính năng**                      | **Mục tiêu hiệu năng**                                      |
|------------------------------------|-------------------------------------------------------------|
| Crawler (DAA + Moodle)             | < 10 giây tổng - có streaming progress hiển thị từng bước   |
| Smart-Scheduler (CSP/Backtracking) | < 7 giây với ~1.000 tổ hợp                                  |
| AI Response (Gemini)               | Streaming - bắt đầu thấy chữ trong < 3 giây                 |
| Roadmap render                     | < 1 giây sau khi dữ liệu sẵn sàng                           |
| Tooltip hiển thị                   | < 200ms sau hover                                           |
| Bot response                       | < 2 giây từ lúc gửi lệnh                                    |

## **5.3 Giao diện (UI/UX)**

- Dark Mode: giao diện mặc định tối - phù hợp sinh viên IT.

- Responsive: tối ưu hiển thị TKB trên mobile.

- Onboarding: hướng dẫn visual (ảnh step-by-step) cho luồng lấy cookie
  lần đầu.

- Empty States: mọi trang đều có empty state rõ ràng khi chưa có dữ
  liệu.

## **5.4 Khả năng mở rộng**

- Bot Gateway được thiết kế module - thêm nền tảng mới (VD: Zalo) chỉ
  cần thêm adapter.

- Vector DB (pgvector) sẵn sàng nhận thêm văn bản quy chế mới mà không
  cần migration.

- AI Model có thể swap (Gemini -> GPT-4 hoặc model khác) qua config,
  không đụng business logic.

## **5.5 Rate Limiting**

Để bảo vệ DAA/Moodle khỏi bị flood (đặc biệt giờ peak 7h sáng) và bảo vệ
chi phí AI:

| **Hành động**           | **Giới hạn**                          |
|-------------------------|---------------------------------------|
| Crawl DAA               | Tối đa 5 request / giờ / SV           |
| Crawl Moodle on-demand  | Tối đa 10 request / giờ / SV          |
| AI Mate                 | Tối đa 30 message / giờ / SV          |
| Bot command             | Tối đa 10 command / giờ / SV          |

**Toàn cục:** Queue request crawl DAA để tránh DDoS DAA lúc 7h sáng
(peak) - nếu quá ngưỡng concurrent thì xếp hàng và hiện trạng thái
"Đang chờ trong hàng đợi, vị trí thứ N..." cho SV.

## **5.6 Known Risks & Mitigation**

| **Rủi ro**                                                                          | **Mitigation**                                                                                                       |
|-------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Master key (Vault Transit) lưu trong env var -> server compromise = lộ MK của tất cả SV. | Hạn chế tối thiểu người có quyền truy cập dashboard hosting; bật audit log truy cập env var; rotate key định kỳ.    |
| Crawl DAA phụ thuộc HTML structure -> DAA đổi giao diện = parser hỏng.               | Monitor crawl error rate; có alert khi error rate > X%; có cơ chế hotfix nhanh cho parser.                            |
| Lưu MSSV + MK của SV -> vi phạm nguyên tắc data minimization nếu không có consent.   | Bắt buộc consent checkbox + Privacy Policy trước khi sync (xem 3.1.1 - Bước 0).                                      |
| Spam DAA gây lock account SV.                                                       | Rate limit (5.5) + cooldown 60s khi sai captcha 3 lần (xem 3.1.1).                                                   |
| AI hallucination về quy chế.                                                        | RAG ưu tiên văn bản gốc; Disclaimer footer bắt buộc trên mọi câu trả lời liên quan quy chế (xem 3.3).                |

# **APPENDIX: Phạm vi v1**

**Trong scope v1 (đầy đủ 6 phân hệ):**

- Phân hệ 1: Academic Tracker (DAA + Moodle, Roadmap, GPA Suite)
- Phân hệ 2: UIT Scheduler (Smart Recommendation + Auto-Scheduler + .ics
  Export)
- Phân hệ 3: AI Mate (Context Injection + RAG + Hybrid Storage)
- Phân hệ 4: Smart Tooltip
- Phân hệ 5: Admin Dashboard (Auth + Course + Resource + Policy + CTĐT
  + Elective Groups)
- Phân hệ 6: Remote Bot (Telegram -> Discord -> Messenger theo phase)

Môn tự chọn (Elective Groups) **được hỗ trợ đầy đủ** trong v1.

**Ngoài scope v1 (backlog):**

| **Tính năng**                      | **Lý do để backlog**                                              |
|------------------------------------|-------------------------------------------------------------------|
| Chat AI qua Bot (Telegram/Discord) | AI Mate cần context điểm số + auth phức tạp - chỉ có trên Web App |
| Mobile App (iOS/Android)           | Web responsive đủ dùng cho v1                                     |
| Tích hợp trực tiếp API trường      | Phụ thuộc bên ngoài - rủi ro cao, cookie-based đủ cho v1          |
| Admin Analytics Dashboard          | Nice-to-have, xem xét sau khi có đủ data                          |
| Multi-admin / RBAC                 | v1 chỉ cần single-admin - đủ cho giai đoạn pilot                  |

*- End of Document -*
