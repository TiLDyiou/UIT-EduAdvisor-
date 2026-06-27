# Review codebase (toàn bộ mã nguồn) UIT EduAdvisor

Ngày review: 2026-05-29

Tài liệu này dùng để đọc trước khi code tiếp. Mục tiêu là trả lời 4 câu hỏi:

1. Code hiện đã có những phần nào?
2. Phần nào đang chạy được nhưng chưa đủ chắc?
3. Phần nào còn thiếu hoặc lệch so với PRD?
4. Phần nào đang phản logic UI/UX, tức làm người dùng dễ hiểu sai hoặc thao tác sai?

PRD là tài liệu yêu cầu sản phẩm. Nói đơn giản: PRD mô tả app cần có gì, còn file này mô tả code hiện có đang khớp hoặc lệch PRD ra sao.

## Tóm Tắt Nhanh

Codebase (toàn bộ mã nguồn của dự án) hiện không còn ở mức chỉ có onboarding. Onboarding là bước người dùng đăng nhập và đồng bộ dữ liệu lần đầu. Thực tế đã có nhiều phần lớn:

- Web cho sinh viên: trang chủ, onboarding, tracker, GPA tools, scheduler, AI Mate, settings.
- Web cho admin: phần giao diện cho quản trị viên, gồm quản lý môn học, chương trình đào tạo, tài nguyên, tooltip, văn bản quy chế, import, job và audit.
- Backend: phần server xử lý dữ liệu và nghiệp vụ, gồm API cho sinh viên, admin, tracker, scheduler, AI Mate, bot, đồng bộ DAA/Moodle.
- Hạ tầng local: môi trường chạy trên máy dev, gồm Postgres, Redis, Vault, API, web, worker và bot chạy qua Docker Compose. Docker Compose là công cụ chạy nhiều service cùng lúc bằng một file cấu hình.

Nhưng có một điểm cần nói thẳng: code đã rộng hơn README. README là file hướng dẫn chính ở đầu repo. README vẫn nói trạng thái chính là M2 onboarding, trong khi code đã có nhiều phần của M3 đến M7. M2 đến M7 là các mốc phát triển trong roadmap. Nếu người mới đọc README trước, họ sẽ hiểu sai mức độ hoàn thiện thật.

## Cấu Trúc Repo

Repo đang là monorepo, nghĩa là nhiều app nằm chung trong một repository. Repository là nơi lưu mã nguồn và lịch sử thay đổi của dự án.

Các thư mục chính:

- `apps/api`: backend, tức phần xử lý dữ liệu và nghiệp vụ phía server.
- `apps/web`: frontend, tức giao diện người dùng chạy trên trình duyệt.
- `infra`: cấu hình Docker Compose, tức cách chạy nhiều service local cùng lúc.
- `docs`: PRD, runbook, prototype, tài liệu pháp lý và tài liệu review.

Nhìn theo luồng chạy:

```text
Người dùng mở web
-> Next.js frontend
-> gọi API
-> FastAPI backend
-> đọc/ghi Postgres, Redis, Vault
-> khi cần thì gọi DAA, Moodle, Gemini hoặc bot platform
```

Giải thích nhanh:

- Next.js là framework frontend, tức bộ công cụ để viết giao diện web bằng React.
- FastAPI là framework backend, tức bộ công cụ để viết phần server bằng Python.
- API là cổng giao tiếp để frontend hỏi backend lấy dữ liệu hoặc gửi thao tác.
- Postgres là database chính, tức nơi lưu dữ liệu lâu dài.
- Redis là bộ nhớ tạm tốc độ cao, đang dùng cho session, rate limit và tiến trình job.
- Vault là dịch vụ mã hóa, dùng để mã hóa dữ liệu nhạy cảm như mật khẩu sinh viên.

## Những Gì Đã Có

### 1. Onboarding sinh viên

Đã có luồng nhập MSSV, mật khẩu, captcha DAA, tick đồng ý Privacy/ToS, sau đó bắt đầu đồng bộ dữ liệu. Captcha là mã xác nhận để chứng minh người thao tác là người thật. Privacy/ToS là chính sách riêng tư và điều khoản sử dụng.

Vì sao phần này quan trọng: đây là cửa vào của toàn bộ sản phẩm. Nếu onboarding không rõ ràng, người dùng sẽ không tin app đủ an toàn để nhập tài khoản trường.

Hiện code đã có:

- Lấy captcha DAA.
- Gửi MSSV, mật khẩu, captcha lên backend.
- Tạo session đăng nhập cho app. Session là phiên đăng nhập, giúp app nhớ người dùng đã đăng nhập mà không cần nhập lại mật khẩu ở mỗi trang.
- Chạy đồng bộ nền.
- Hiển thị tiến trình sync qua SSE.

SSE là cơ chế server gửi cập nhật liên tục về trình duyệt. Nói đơn giản: thay vì web hỏi đi hỏi lại "xong chưa?", server tự đẩy trạng thái mới về web.

Điểm cần xem lại:

- Checkbox đồng ý chính sách đang quá ngắn. PRD yêu cầu người dùng phải đọc và hiểu rõ việc app lưu mật khẩu đã mã hóa để tự động sync Moodle.
- Trang chưa hiển thị hoặc dẫn rõ đến nội dung Privacy Policy và Terms of Service trước khi người dùng tick.
- Nếu sync fail, người dùng cần biết fail ở bước nào: DAA, Moodle, captcha, mạng hay parser. Sync fail nghĩa là đồng bộ thất bại. Parser là đoạn code đọc dữ liệu thô rồi tách ra thành dữ liệu có cấu trúc.

### 2. Academic Tracker

Đã có trang roadmap và GPA tổng quan.

Roadmap là bản đồ môn học theo học kỳ. Mục tiêu của nó là giúp sinh viên nhìn được môn nào đã qua, môn nào đang học, môn nào rớt, môn nào bị khóa do thiếu tiên quyết.

Tiên quyết nghĩa là môn phải học trước thì mới được học môn sau.

Hiện code đã có:

- Gọi API lấy roadmap.
- Hiển thị môn theo từng kỳ.
- Màu trạng thái cho passed, in progress, failed, locked, not started.
- Preview mode khi chưa có điểm.
- Hiển thị nhóm tự chọn ở dạng badge.
- Tooltip cho một số thông tin điểm.

Điểm cần xem lại:

- PRD yêu cầu click vào node môn học để sang trang chi tiết môn. Node là ô/điểm đại diện cho một môn trong roadmap. Hiện UI chủ yếu hover, chưa thấy luồng chi tiết môn. Hover là đưa chuột lên một vùng để xem thêm thông tin.
- Nhóm tự chọn trong PRD cần render như một khung nhóm trong roadmap. Render nghĩa là hiển thị ra giao diện. Hiện mới là badge tổng hợp phía dưới. Badge là nhãn nhỏ trên UI. Vì vậy người dùng khó hiểu môn nào thuộc nhóm nào.
- Tooltip ĐTBC/ĐTBCTL đang viết cứng trong code. PRD yêu cầu Smart Tooltip do admin quản lý, nghĩa là admin sửa nội dung mà không cần sửa code.

Vì sao cần sửa: tracker là nơi người dùng ra quyết định học gì tiếp. Nếu UI chỉ đẹp nhưng không giải thích đúng quan hệ môn học và nhóm tự chọn, sinh viên dễ đăng ký sai hoặc hiểu sai tiến độ tốt nghiệp.

### 3. GPA Tools

Đã có 3 công cụ:

- GPA Simulator: nhập điểm giả định để xem GPA dự kiến.
- Reverse Calculator: nhập GPA mục tiêu để tính điểm cần đạt.
- Retake Estimator: chọn môn học lại để xem GPA tăng bao nhiêu.

GPA là điểm trung bình. UIT có cả thang 10 và thang 4, nên PRD yêu cầu hiển thị song song nhưng ưu tiên thang 10.

Điểm còn thiếu so với PRD:

- Reverse Calculator chưa có toggle chọn đầu vào thang 10 hoặc thang 4.
- Retake Estimator chưa tính chi phí học lại.
- GPA scale có ghi chú cần admin xác nhận theo quy định UIT chính thức.

Vì sao cần sửa: GPA là dữ liệu nhạy cảm về học vụ. Nếu công thức hoặc thang điểm chưa chắc, app không nên tạo cảm giác "đây là kết quả chính thức".

### 4. UIT Scheduler

Đã có luồng:

1. Upload file Excel TKB.
2. Gợi ý môn học.
3. Chọn môn muốn học.
4. Chọn các tiết có thể học.
5. Backend xếp lịch.
6. Hiển thị phương án và xuất `.ics`.

`.ics` là file lịch chuẩn để import vào Google Calendar hoặc Apple Calendar.

Điểm cần xem lại:

- Khi xuất `.ics`, `term_start` đang lấy ngày hiện tại làm ngày bắt đầu học kỳ. Đây chỉ là giá trị tạm, dễ làm lịch xuất ra sai ngày.
- PRD yêu cầu stable UID. UID là mã định danh của event lịch. Nếu UID ổn định, import lại cùng một lịch sẽ cập nhật event cũ thay vì tạo trùng.
- UI chỉ có nút xuất file `.ics`, chưa có hướng dẫn hoặc luồng rõ cho Google Calendar/Apple Calendar.
- PRD yêu cầu top 5 môn gợi ý cộng thêm môn đại cương chưa hoàn thành. UI hiện đang hiển thị 8 gợi ý đầu, dễ lệch logic sản phẩm.
- Lỗi upload hoặc lỗi gợi ý đang bị log vào console nhiều hơn là báo rõ cho người dùng.

Vì sao cần sửa: scheduler là tính năng tiết kiệm thời gian. Nếu lịch xuất sai ngày hoặc gợi ý môn không giải thích được, người dùng sẽ mất niềm tin rất nhanh.

### 5. AI Mate

Đã có trang chat AI, lưu chat cục bộ trong trình duyệt, có stream câu trả lời, có nguồn tài liệu và disclaimer. Chat cục bộ nghĩa là nội dung được lưu trên máy/trình duyệt của người dùng. Disclaimer là dòng cảnh báo để nhắc câu trả lời chỉ mang tính tham khảo.

Stream nghĩa là AI trả lời từng phần, người dùng thấy chữ hiện dần thay vì chờ toàn bộ câu trả lời xong.

RAG là cách AI lấy thêm tài liệu nội bộ trước khi trả lời. Nói đơn giản: AI không chỉ đoán từ kiến thức chung, mà còn tra quy chế đã upload để trả lời sát hơn.

Hiện code đã có:

- Chat streaming. Streaming nghĩa là câu trả lời hiện dần từng phần thay vì chờ xong toàn bộ.
- Lưu lịch sử chat trong IndexedDB.
- IndexedDB là nơi lưu dữ liệu trong trình duyệt, phù hợp hơn localStorage khi dữ liệu nhiều.
- Xóa chat cục bộ cũ hơn 30 ngày.
- Ghim tin nhắn lên server.
- Tạo summary phiên chat. Summary là bản tóm tắt nội dung chính, không phải toàn bộ câu chữ người dùng đã gửi.

Điểm cần xem lại:

- Trang AI Mate có thể mở khi chưa onboarding. Khi gửi câu hỏi mới báo lỗi cần đăng nhập. Luồng tốt hơn là chặn sớm hoặc giải thích rõ "đăng nhập để AI dùng dữ liệu học vụ cá nhân".
- Nút "Kết thúc phiên" hiện phụ thuộc người dùng bấm thủ công. PRD nói lưu summary sau mỗi phiên, cần xác định rõ "khi nào là kết thúc phiên".
- Cần kiểm tra UI xem người dùng có xem và xóa được summary server đủ dễ như PRD yêu cầu chưa.

Vì sao cần sửa: AI Mate dùng dữ liệu cá nhân để trả lời. Nếu người dùng không hiểu lúc nào dữ liệu được gửi đi, lúc nào được lưu, app sẽ yếu về niềm tin và quyền riêng tư.

### 6. Settings

Settings đã có:

- Xem trạng thái mật khẩu đã lưu.
- Xóa mật khẩu đã mã hóa.
- Xóa toàn bộ dữ liệu cá nhân.
- Xem/xóa summary AI.
- Xóa lịch sử AI.
- Kết nối bot Telegram, Discord, Messenger.
- Bật/tắt nhắc lịch thi và deadline.

Điểm phản UI/UX rõ nhất:

- Nhiều text tiếng Việt đang mất dấu: "Cai dat", "Xoa", "Ket noi", "Nhac nho".
- Đây không phải lỗi nhỏ. Với app học vụ, chữ mất dấu làm giao diện có cảm giác chưa hoàn thiện và giảm độ tin cậy.
- Các thao tác nguy hiểm đã có confirm, nhưng nội dung confirm cũng mất dấu nên chưa đủ rõ.

Vì sao cần sửa: Settings là nơi người dùng quản lý dữ liệu cá nhân. Giao diện ở đây phải rõ, chuẩn tiếng Việt và không gây mơ hồ.

### 7. Admin Dashboard

Admin dashboard đã có nhiều phần:

- Quản lý môn học.
- Quản lý chương trình đào tạo.
- Quản lý tài nguyên môn học.
- Quản lý tooltip.
- Quản lý văn bản quy chế.
- Import dữ liệu.
- Xem job.
- Xem audit log.

Audit log là nhật ký thao tác quan trọng. Nói đơn giản: admin làm gì, lúc nào, tác động lên dữ liệu nào thì hệ thống ghi lại.

Điểm cần xem lại:

- Admin import có preview nhưng một số chỗ còn trạng thái pending worker preview. Preview là xem trước kết quả import. Pending nghĩa là đang chờ xử lý. Worker là tiến trình chạy nền để xử lý việc nặng.
- Quản lý version văn bản quy chế backend đã có restore/deprecate, nhưng cần kiểm tra UI đã đủ dễ hiểu chưa.
- Tooltip admin có API và page riêng, nhưng frontend sinh viên chưa dùng tooltip động rộng rãi.
- Khi thêm endpoint admin mới, bắt buộc kiểm tra CSRF và audit log. Endpoint là một đường dẫn API cụ thể, ví dụ đường dẫn để tạo môn học hoặc xóa văn bản.

CSRF là cơ chế chống web khác giả mạo thao tác của người dùng. Nói đơn giản: tránh việc admin đang đăng nhập bị một trang lạ lừa gửi yêu cầu xóa/sửa dữ liệu.

## Rủi Ro Kỹ Thuật Cần Biết

### Rủi ro cao

1. Vault đang chạy dev-mode trong Docker Compose.

Dev-mode nghĩa là chế độ phát triển local, không phù hợp production. Nếu dùng dữ liệu thật, restart có thể làm mất khả năng giải mã dữ liệu đã lưu.

Vì sao nguy hiểm: app có lưu mật khẩu sinh viên đã mã hóa. Nếu key mã hóa mất, dữ liệu cũ có thể không giải mã được nữa.

2. Background sync đang chạy trong process API.

Process API là tiến trình đang chạy backend. Nếu container restart hoặc crash giữa lúc sync, job có thể kẹt.

Vì sao nguy hiểm: sinh viên thấy "đang đồng bộ" nhưng hệ thống không tự hồi phục tốt.

3. Parser DAA/Moodle phụ thuộc HTML bên ngoài.

Parser là code đọc HTML/JSON từ DAA hoặc Moodle rồi trích xuất dữ liệu. Nếu trường đổi giao diện hoặc đổi cấu trúc HTML, parser có thể hỏng.

Vì sao nguy hiểm: app có thể đăng nhập được nhưng lấy sai hoặc không lấy được điểm, TKB, lịch thi.

4. Docker Compose chưa truyền đủ biến môi trường production.

Biến môi trường là cấu hình truyền vào app khi chạy, ví dụ key Gemini, cookie secure, bot token.

Vì sao nguy hiểm: local vẫn chạy nhờ default, nhưng production có thể âm thầm chạy sai.

### Rủi ro trung bình

1. Frontend test còn mỏng.

Test là đoạn kiểm tra tự động. Hiện backend có khá nhiều test, nhưng frontend còn ít so với số trang quan trọng.

Vì sao ảnh hưởng: onboarding, scheduler, settings, admin CRUD dễ bị hỏng UI mà CI không bắt được.

2. RAG fallback có thể tạo cảm giác chạy được nhưng chất lượng không thật.

Fallback là cách chạy thay thế khi thiếu Gemini key hoặc embedding thật. Embedding là dạng số hóa nội dung để tìm kiếm theo ý nghĩa.

Vì sao ảnh hưởng: local/test có thể pass, nhưng không phản ánh chất lượng tư vấn thật khi dùng production.

3. Bot mock mode dễ gây hiểu nhầm.

Mock mode là chế độ giả lập gửi tin, không gửi qua Telegram/Discord/Messenger thật.

Vì sao ảnh hưởng: production cần báo rõ khi bot token thiếu, nếu không admin tưởng hệ thống đang gửi thông báo thật.

## Những Phần Lệch PRD Cần Code Thêm

Danh sách này ưu tiên theo tác động sản phẩm.

### P0 - Cần sửa trước khi cho dùng thật

1. Onboarding phải hiển thị rõ nội dung hoặc link Privacy Policy và ToS trước checkbox.

Vì PRD yêu cầu minh bạch chuyện lưu mật khẩu đã mã hóa. Đây là điều kiện để người dùng tin app.

2. Scheduler export `.ics` không được dùng ngày hiện tại làm ngày bắt đầu học kỳ.

Cần lấy ngày bắt đầu học kỳ từ dữ liệu học kỳ, admin config hoặc input người dùng. Nếu không, lịch import sẽ sai.

3. Settings phải sửa toàn bộ tiếng Việt mất dấu.

Vì đây là trang quản lý dữ liệu cá nhân và thao tác nguy hiểm. Text phải rõ, có dấu, dễ hiểu.

4. GPA scale phải được xác nhận theo quy chế UIT.

Nếu chưa xác nhận, UI cần ghi rõ kết quả là tham khảo. Không nên để người dùng hiểu đây là kết quả chính thức.

### P1 - Nên code tiếp để khớp PRD

1. Roadmap node cần click được để mở trang chi tiết môn.

Trang chi tiết nên có tài nguyên, điều kiện tiên quyết, quy chế liên quan và trạng thái học tập.

2. Nhóm tự chọn cần hiển thị như container trong roadmap.

Container nghĩa là một khung gom các môn cùng nhóm. Cách này giúp sinh viên hiểu họ cần chọn bao nhiêu tín chỉ hoặc bao nhiêu môn trong nhóm đó.

3. Smart Tooltip cần dùng dữ liệu admin quản lý thay vì hard-code trong từng page.

Hard-code nghĩa là viết cố định trong code. Nếu admin sửa tooltip trong dashboard nhưng sinh viên không thấy thay đổi, tính năng chưa đạt PRD.

4. Reverse Calculator cần cho chọn thang điểm đầu vào 10 hoặc 4.

Vì PRD yêu cầu toggle này và sinh viên có thể đặt mục tiêu theo cả hai thang.

5. Retake Estimator cần tính chi phí học lại.

Vì quyết định học cải thiện không chỉ dựa vào GPA tăng bao nhiêu, mà còn dựa vào chi phí.

6. Scheduler recommendation cần khớp công thức PRD.

Cụ thể: top 5 theo score cộng thêm danh sách môn đại cương chưa hoàn thành. Không nên tự đổi thành 8 môn đầu nếu không có lý do sản phẩm.

7. AI Mate cần rõ luồng chưa đăng nhập.

Nếu AI cần dữ liệu học vụ cá nhân thì nên yêu cầu onboarding trước. Nếu cho hỏi chung, UI phải nói rõ câu trả lời không dùng dữ liệu cá nhân.

### P2 - Nên làm để sản phẩm dễ vận hành

1. Cập nhật README theo trạng thái thật.

README đang nói M2, nhưng code đã có M3-M7. Người mới vào dự án sẽ bị lệch kỳ vọng.

2. Thêm checklist production env.

Production env là cấu hình chạy thật. Cần liệt kê biến bắt buộc cho API, web, worker, AI, bot, cookie secure.

3. Chuyển background job sang cơ chế bền hơn.

Cơ chế bền hơn nghĩa là job không mất trạng thái khi API restart. Có thể dùng Redis queue hoặc worker riêng.

4. Thêm test frontend cho luồng quan trọng.

Ưu tiên onboarding, settings, scheduler, AI Mate và admin CRUD.

CRUD là tạo, đọc, sửa, xóa dữ liệu.

## Những Chỗ Phản Logic UI/UX

1. Trang chủ dẫn vào AI Mate dù người dùng chưa onboarding.

Nếu AI Mate cần ngữ cảnh học vụ cá nhân, người dùng nên được hướng dẫn đăng nhập trước. Nếu không, họ sẽ bấm vào rồi mới bị báo lỗi khi gửi tin.

2. Settings là trang nhạy cảm nhưng text bị mất dấu.

Điều này làm người dùng khó đọc và giảm cảm giác an toàn khi thao tác xóa dữ liệu.

3. Scheduler chọn khung giờ "có thể học", nhưng nếu bỏ chọn hết vẫn có thể bấm xếp lịch.

Cần xác nhận backend xử lý thế nào. Về UX, nên cảnh báo rõ "bạn chưa chọn khung giờ nào" thay vì để người dùng chờ rồi nhận kết quả rỗng.

4. Scheduler export lịch không cho người dùng chọn ngày bắt đầu học kỳ.

Người dùng có thể tưởng file lịch đúng, nhưng code đang dùng ngày hiện tại. Đây là lỗi UX vì giao diện không nói đây là giả định.

5. Roadmap có hover tooltip, nhưng mobile không có hover đúng nghĩa.

Hover là đưa chuột lên để hiện thông tin. Trên điện thoại, người dùng chạm màn hình nên cần click/tap state rõ ràng.

6. Tooltip dùng nhiều nguồn khác nhau.

Một số tooltip nằm trong code, một số có admin quản lý. Người dùng không quan tâm nguồn nào, nhưng admin sẽ khó kiểm soát nội dung thống nhất.

7. AI Mate có nút "Kết thúc phiên" nhưng người dùng không chắc vì sao cần bấm.

Nếu bấm nút này để tạo summary server, UI cần nói rõ lợi ích và dữ liệu nào sẽ được lưu.

## Nguyên Tắc Khi Code Tiếp

1. Trước khi sửa, chạy `git status --short`.

Vì repo đang có nhiều thay đổi chưa commit. Không được ghi đè thay đổi không phải của mình.

2. Nếu sửa API, đọc đủ route, schema, service và test liên quan.

Route là nơi nhận request. Schema là kiểu dữ liệu vào/ra. Service là nơi chứa logic nghiệp vụ.

3. Nếu sửa DB model, phải có migration.

Migration là file thay đổi cấu trúc database. Nếu quên migration, máy khác hoặc production sẽ không có bảng/cột mới.

4. Nếu sửa dữ liệu nhạy cảm, kiểm tra session, CSRF, audit log và rate limit.

Rate limit là giới hạn số lần gọi API trong một khoảng thời gian, dùng để giảm spam hoặc brute force.

5. Nếu sửa parser DAA/Moodle, thêm fixture test.

Fixture là dữ liệu mẫu dùng cho test. Với parser, nên có HTML mẫu đã ẩn thông tin nhạy cảm để kiểm tra khi code thay đổi.

6. Nếu sửa UI quan trọng, phải kiểm tra loading, empty, error và mobile.

Loading là trạng thái đang tải. Empty là trạng thái không có dữ liệu. Error là trạng thái lỗi. Mobile là giao diện trên điện thoại.

## Checklist Trước Mỗi Lần Code

- File mình định sửa có đang bị user sửa dở không?
- Thay đổi này có thật sự nằm trong yêu cầu không?
- Có cần migration không?
- Có đụng mật khẩu, session, cookie, consent hoặc dữ liệu cá nhân không?
- Có cần CSRF không?
- Có cần audit log không?
- Có cần cập nhật `.env.example` không?
- Có cần cập nhật README hoặc docs không?
- Có test gần nhất cho phần bị sửa chưa?
- UI có đủ trạng thái loading, empty, error không?
- Mobile có dùng được không?
- Có đang hard-code thứ mà admin đáng lẽ quản lý không?

## Kết Luận

Codebase đã có nền khá rộng, đủ để tiếp tục phát triển theo PRD. Vấn đề chính không phải là thiếu hết tính năng, mà là nhiều tính năng đang ở mức "đã có khung" nhưng chưa đủ đúng luồng sản phẩm.

Ưu tiên tiếp theo nên là:

1. Sửa các điểm có thể làm sai dữ liệu thật: scheduler `.ics`, GPA scale, ngày bắt đầu học kỳ.
2. Sửa các điểm ảnh hưởng niềm tin: onboarding consent, settings tiếng Việt, AI Mate privacy flow.
3. Sửa các điểm lệch PRD: roadmap detail, elective group container, tooltip động, recommendation đúng công thức.
4. Sau đó mới hoàn thiện giao diện và mở rộng test.
