# UIT EduAdvisor

**Tác giả:** Đặng Nguyễn Gia Bảo (24520147) và Nguyễn Đức Đại (24520245)

**Tỉ lệ đóng góp:** 50% - 50%

**Đã được triển khai tại:** <https://uit-edu-advisor-two.vercel.app>

**Link Video demo full tính năng:** https://drive.google.com/file/d/18DplbGJAdLhsW6n8YqCJWw7JTvIRQIGI/view?usp=sharing

UIT EduAdvisor là một nền tảng Web Application hỗ trợ học vụ dành riêng cho sinh viên Đại học Công nghệ Thông tin (UIT). Hệ thống giúp sinh viên trực quan hóa lộ trình học tập, tối ưu thời khóa biểu, và được tư vấn trực tiếp bởi trợ lý AI.

## 1. Frontend (Giao diện Web)

- **Chức năng:** Cung cấp giao diện tương tác trực quan cho người dùng. Cho phép sinh viên xem điểm số, sơ đồ lộ trình học tập, tính toán và dự báo GPA, sắp xếp thời khóa biểu và trò chuyện với trợ lý AI (UIT Mate).
- **Thuật toán áp dụng:**
  - _Interactive TreeView (Giao diện kiểu File Explorer):_ Hệ thống kết xuất lộ trình học tập dưới dạng danh sách phân cấp (TreeView) theo từng học kỳ tương tự như cây thư mục. Ở Backend, thuật toán phân giải đồ thị có hướng không chu trình (DAG) tính toán bộ điều kiện tiên quyết bằng cách giao cắt (intersect) tập môn học bắt buộc với tập các môn sinh viên đã qua môn (điểm >= 5.0). Hệ thống kết hợp dữ liệu điểm số thực tế để gắn mã màu trạng thái (đã qua, đang học, nợ môn, chưa học) cho từng môn. _(Minh chứng tại: `apps/web/app/(dashboard)/tracker/page.tsx` và `apps/api/app/services/academic/roadmap.py`)_
  - _GPA Simulator & Tools:_ Thuật toán tính toán điểm trung bình chung tích lũy và dự báo điểm (Reverse-GPA). Xử lý chính xác bằng kiểu dữ liệu `Decimal` nhằm triệt tiêu sai số dấu phẩy động (float precision error). Khi sinh viên học lại (Retake), thuật toán sẽ tự động phân giải `term_code` (VD: HK1*2024 -> 20241) để chọn ra điểm của lần học gần nhất thay vì điểm cao nhất theo đúng quy chế.*(Minh chứng tại: `apps/api/app/services/academic/gpa.py` và `apps/web/app/(dashboard)/gpa-tools/page.tsx`)
- **Thư viện sử dụng:**
  - `Next.js` và `React`: Framework frontend mạnh mẽ, hỗ trợ Server-Side Rendering (SSR).
  - `TailwindCSS` và `@mui/material`: Dùng để xây dựng các component giao diện hiện đại và reponsive.
  - `@mui/x-charts`: Dùng để vẽ các biểu đồ trực quan (như tiến độ học tập).
  - `Zod`: Thư viện tạo schema dùng để xác thực dữ liệu đầu vào ở phía client.

## 2. Backend (API Server)

- **Chức năng:** Xử lý toàn bộ logic nghiệp vụ (business logic) của hệ thống: đồng bộ dữ liệu (crawling) từ cổng thông tin DAA và hệ thống Moodle, thực hiện tính toán xếp lịch tự động và làm cổng giao tiếp với AI.
- **Thuật toán áp dụng:**
  - _Cookie-based Delegated Scraping:_ Quản lý phiên đăng nhập (session) trên RAM để crawl dữ liệu an toàn. _(Minh chứng tại: `apps/api/app/services/daa/parser.py` và `apps/api/app/services/sync/moodle_sync.py`)_
  - _Smart-Scheduler (Xếp lịch tự động bằng Backtracking & Pruning):_ Hệ thống tự động ghép nối lớp Lý thuyết và Thực hành dựa trên `section_code`. Thuật toán duyệt đệ quy không gian tổ hợp kết hợp kiểm tra trùng lặp thông qua tập hợp (Set) các cặp `(day_of_week, period)`. Áp dụng cơ chế **Allowed Skips** để tự động lược bỏ (drop) môn khi không thể xếp lịch hoàn chỉnh, và có giới hạn thời gian (Timeout) 7 giây để đảm bảo API luôn phản hồi nhanh chóng. Thời khóa biểu kết quả có thể được xuất ra ảnh **PNG** (thông qua `html-to-image` ở phía Client) hoặc file **.ics** (thông qua API tạo iCalendar format ở Backend) để đồng bộ vào Google Calendar. _(Minh chứng tại: `apps/api/app/services/academic/scheduler.py` và `apps/web/app/(dashboard)/scheduler/components/Step3Results.tsx`)_
- **Thư viện sử dụng:**
  - `FastAPI`: Web framework bất đồng bộ tốc độ cao xây dựng các endpoint API.
  - `Uvicorn`: ASGI server tiêu chuẩn để chạy ứng dụng FastAPI.
  - `SQLAlchemy` và `asyncpg`: Lớp ORM và Database driver bất đồng bộ.
  - `BeautifulSoup4`: Parser HTML bóc tách thông tin từ cấu trúc web của hệ thống DAA.
  - `hvac`: Giao tiếp với HashiCorp Vault bảo mật (mã hóa FLE) dữ liệu đăng nhập.
  - `bcrypt`: Băm và kiểm tra mật khẩu cho tài khoản Admin.

## 3. Cơ sở dữ liệu (Database & Caching)

- **Chức năng:** Nơi lưu trữ thông tin sinh viên, điểm số, lộ trình đào tạo chuẩn, lịch học, văn bản quy chế và xử lý bộ nhớ đệm (caching).
- **Thuật toán áp dụng:**
  - _Vector Search Indexing:_ Sử dụng hệ thống lập chỉ mục trên không gian vector của PostgreSQL để tìm kiếm tương đồng, hỗ trợ trích xuất nhanh các văn bản quy chế liên quan nhất đến câu hỏi của người dùng. _(Minh chứng tại: `apps/api/app/db/models/rag_chat.py`)_
- **Thư viện/Công nghệ sử dụng:**
  - `PostgreSQL`: Hệ quản trị CSDL quan hệ chính của dự án.
  - `pgvector`: Extension của PostgreSQL cho phép lưu trữ và truy vấn vector embedding.
  - `Redis`: Hệ thống lưu trữ in-memory dùng để lưu trữ session, mã OTP tạm thời (cho tính năng email), và kiểm soát rate-limiting.

## 4. AI Engine (Trợ lý ảo UIT Mate)

- **Chức năng:** Đóng vai trò làm trợ lý học tập ảo 24/7. Trợ lý này tư vấn lộ trình học, giải đáp thắc mắc về quy chế học vụ dựa trên thông tin cá nhân hóa của sinh viên.
- **Thuật toán áp dụng:**
  - _RAG (Retrieval-Augmented Generation):_ Sử dụng mô hình `gemini-embedding-2` để mã hóa văn bản quy chế thành vector 768 chiều. Lưu trữ và truy vấn L2 Distance / Cosine Similarity thông qua `pgvector` trên PostgreSQL. _(Minh chứng tại: `apps/api/app/services/ai_mate/rag_retrieval.py`)_
  - _Context Injection & SSE Streaming:_ Hàm `build_realtime_context_block` tự động truy vấn DB để tiêm vào Prompt toàn bộ thông tin cá nhân hóa (Ngành học, GPA, Tín chỉ tích lũy, Môn đang học, Lịch thi sắp tới). Kết quả từ mô hình được xử lý sinh văn bản kiểu luồng (streaming) qua cơ chế Server-Sent Events (SSE) `aiter_lines` bằng `httpx` để tối ưu thời gian phản hồi chữ đầu tiên (TTFB). _(Minh chứng tại: `apps/api/app/services/ai_mate/context.py` và `apps/api/app/services/ai_mate/gemini.py`)_
- **Thư viện/Công nghệ sử dụng:**
  - `Groq API (Mô hình openai/gpt-oss-120b)`: Được sử dụng để làm mô hình ngôn ngữ lớn (LLM) phục vụ sinh văn bản (streaming) phản hồi nhanh chóng cho người dùng thông qua `httpx`.
  - `Google Gemini (gemini-embedding-2)`: Sử dụng riêng cho tác vụ tạo vector nhúng (embedding) của văn bản trong RAG.

## 5. Hệ thống Thông báo (Notification Gateway)

- **Chức năng:** Gửi lời nhắc lịch thi, thông báo deadline bài tập sắp tới qua các nền tảng nhận thông báo (hiện tại hỗ trợ Email và Discord DM).
- **Thuật toán áp dụng:**
  - _Identity Linking:_ Hệ thống sinh mã liên kết (link*token) hoặc tạo mã OTP ngẫu nhiên với thời gian sống (TTL) 5 phút lưu trong Redis. Cơ chế này giúp đối chiếu an toàn người dùng trên hệ thống chat (platform_user_id/email) với tài khoản sinh viên (student_id).*(Minh chứng tại: `apps/api/app/api/v1/bot_link.py` và `apps/api/app/services/bot/real_sender.py`)\_
- **Thư viện/Công nghệ sử dụng:**
  - `aiosmtplib`: Thư viện xử lý gửi email thông báo (Notification) trực tiếp qua giao thức SMTP.
  - `httpx`: Dùng để gửi các HTTP requests trực tiếp đến Discord API (tạo kênh DM và đẩy tin nhắn) mà không cần dùng đến Gateway của Discord.

## 6. Hệ thống Bảo mật (Security)

- **Chức năng:** Đảm bảo tính bí mật, toàn vẹn và chống lạm dụng toàn bộ các khâu xử lý dữ liệu của người dùng trên hệ thống.
- **Biện pháp áp dụng:**
  - _Field-Level Encryption (FLE):_ Sử dụng **HashiCorp Vault Transit Engine** để mã hóa họ tên và mật khẩu sinh viên trước khi lưu vào CSDL. Mật khẩu dùng cho quá trình đồng bộ tự động sẽ không bao giờ xuất hiện ở dạng bản rõ (plaintext). _(Minh chứng tại: `apps/api/app/core/security/vault_transit.py`)_
  - _Rate Limiting:_ Áp dụng hệ thống đếm tần suất trên **Redis** để bảo vệ các Endpoints nhạy cảm (đăng nhập DAA, chat AI, gửi mã OTP), ngăn chặn tấn công Brute-force hoặc lạm dụng tài nguyên LLM. _(Minh chứng tại: `apps/api/app/core/rate_limit.py`)_
  - _Session & CSRF Protection:_ Quản lý phiên làm việc thông qua `HttpOnly, Secure Cookies`, đồng thời kết hợp kiểm tra CSRF (Cross-Site Request Forgery) token cho các thao tác đồng bộ nhạy cảm. _(Minh chứng tại: `apps/api/app/api/v1/resync.py`)_
  - _Log Redaction (Privacy):_ Hàm `redact_dict_for_log` trong module AI tự động dò quét và che giấu (mask) toàn bộ các trường dữ liệu nhạy cảm (password, secret, message content) khỏi nhật ký hệ thống (system logs). _(Minh chứng tại: `apps/api/app/services/ai_mate/privacy.py`)_
  - _Admin Authentication:_ Mật khẩu quản trị viên được băm và xác thực một chiều bằng thuật toán **bcrypt** với salt ngẫu nhiên bảo mật cao. _(Minh chứng tại: `apps/api/app/core/security/passwords.py`)_

## 7. Luồng Xử lý Dữ liệu Sinh viên (Data Flow)

Luồng dữ liệu của hệ thống được vận hành và tái sử dụng qua các thành phần một cách khép kín như sau:

1. **Bước Đăng nhập & Đồng bộ (Onboarding / Scraper):**
   - Sinh viên cung cấp tài khoản DAA/Moodle thông qua API `/onboarding`. Ngay lập tức, **Vault Transit Engine** mã hóa tài khoản thành dạng `ciphertext` và lưu vào PostgreSQL (`StudentCredential`), tuyệt đối không lưu plaintext. Trình duyệt nhận lại một `HttpOnly Cookie` để duy trì phiên đăng nhập.
   - Hàm `run_onboarding_sync` được gọi ngầm dưới dạng `asyncio task` để tiến hành cào dữ liệu (crawling) trực tiếp thông qua thư viện **BeautifulSoup4** (bóc tách các thẻ HTML table, form DOM):
     - **Hệ thống DAA:** Đăng nhập và lấy thông tin cá nhân tại `https://daa.uit.edu.vn/user`, cào bảng điểm tại `/sinhvien/kqhoctap`, cào lịch học tại `/sinhvien/tkb` và lịch thi tại `/sinhvien/tracuu/lichthi`. Hệ thống cũng tự động bóc tách và giải quyết Captcha đăng nhập (lấy token `form_build_id`, `captcha_sid`).
     - **Hệ thống Moodle:** Đăng nhập tại `https://courses.uit.edu.vn/login/index.php` và cào danh sách deadline sắp tới từ cấu trúc DOM của trang `/calendar/view.php?view=upcoming`.
2. **Sử dụng tại Interactive TreeView & GPA Tools:**
   - Điểm số (Grades) và dữ liệu môn học (Enrollments) thu thập được truyền trực tiếp vào thuật toán GPA và tính toán ưu tiên (DAG). Từ đó hiển thị chính xác tiến độ, số tín chỉ tích lũy hiện tại.
3. **Sử dụng tại Smart-Scheduler:**
   - Dữ liệu `Course` (Môn học) và `TermExamSchedule` (Lịch thi) của sinh viên được ghép với hệ thống Lớp học (`Section`) mở trong học kỳ để thuật toán Quay lui xếp lịch tránh xung đột với các môn đang học hoặc đã hoàn thành.
4. **Sử dụng tại AI Engine (UIT Mate):**
   - Thông tin cá nhân (Ngành học, Điểm GPA, Môn đang nợ/chưa qua, Lịch thi sắp tới) được bộ `context.py` tự động truy vấn và **tiêm thẳng vào Prompt (Context Injection)** dưới dạng ngữ cảnh động, kết hợp với các bản tóm tắt lịch sử chat (`ChatSummary`). Nhờ vậy, AI có thể đưa ra câu trả lời cá nhân hóa chính xác mà người dùng không cần giải thích lại tình trạng học tập.
5. **Sử dụng tại Notification Gateway:**
   - Hệ thống tự động truy xuất `Deadline` bài tập (từ Moodle) và `ExamSchedule` lịch thi (từ DAA). Sinh viên thực hiện liên kết (Link) tài khoản Discord/Email qua `link_token` lưu bằng Redis, sau đó hệ thống dùng HTTP request báo trước thời hạn nộp bài.

Chúng em đã biết làm web và hiểu hệ thống web hoạt động như thế nào.
