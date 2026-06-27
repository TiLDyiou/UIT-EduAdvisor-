# 🚀 Hướng Dẫn Deploy Backend lên Google Cloud Platform (GCP) Miễn Phí

Vì Next.js (Frontend) sẽ được host trên Vercel, và Postgres đã nằm trên Neon, chúng ta chỉ cần chạy cụm Backend (API, Bot, Workers, Redis, Vault) trên VPS. Đặc biệt, vì Vercel chạy HTTPS, API của bạn cũng BẮT BUỘC phải có HTTPS (nếu không trình duyệt sẽ chặn lỗi Mixed Content). Chúng ta sẽ dùng Cloudflare Tunnel để giải quyết vụ HTTPS miễn phí!

## Bước 1: Tạo VPS Miễn Phí Trên GCP

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và đăng ký tài khoản (Cần thẻ VISA/MasterCard, Google sẽ trừ 1$ để xác minh rồi hoàn trả lại ngay).
2. Tạo một Project mới.
3. Vào mục **Compute Engine** -> **VM instances** -> Chọn **Create Instance**.
4. **Cấu hình BẮT BUỘC để được Free Vĩnh Viễn:**
   - **Region:** Chọn `us-central1` (Iowa), `us-west1` (Oregon), hoặc `us-east1` (South Carolina). _(Bắt buộc, chọn region khác sẽ bị tính tiền)_.
   - **Machine family:** General-purpose.
   - **Machine type:** Chọn **e2-micro** (2 vCPU, 1GB RAM).
   - **Boot disk:** Chọn `Ubuntu 22.04 LTS` hoặc `24.04 LTS`. Size để `30GB` (GCP cho free tối đa 30GB Standard Persistent Disk).
   - **Firewall:** Tích vào 2 ô "Allow HTTP traffic" và "Allow HTTPS traffic".
5. Bấm **Create** và đợi VPS khởi động. Sau khi tạo xong, bạn sẽ thấy nút **SSH** trên giao diện, bấm vào đó để mở cửa sổ Terminal điều khiển VPS.

---

## Bước 2: Cài Đặt Docker & Chuẩn Bị Code

Trong cửa sổ Terminal SSH của Google Cloud, chạy lần lượt các lệnh sau:

**1. Cài đặt Docker & Git:**

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

**2. Tải Source Code của bạn lên VPS:**
_(Cách tốt nhất là đẩy code của bạn lên GitHub Private, sau đó clone về VPS)_

```bash
git clone https://github.com/TENTAIKHOAN/UIT-EduAdvisor-.git
cd UIT-EduAdvisor-
```

**3. Tạo file `.env`:**

```bash
nano .env
```

Sau đó copy toàn bộ nội dung file `.env` dưới máy bạn dán vào đây (nhớ copy bằng phím `Ctrl + Shift + V` hoặc click chuột phải dán).
_Lưu ý quan trọng:_ Trong file `.env` này, bạn VẪN giữ nguyên biến `POSTGRES_URL_OVERRIDE` trỏ về Neon DB nhé.
Bấm `Ctrl + O` -> `Enter` để lưu, và `Ctrl + X` để thoát.

---

## Bước 3: Khởi Chạy Backend (Chừa Frontend và Database lại)

RAM của e2-micro chỉ có 1GB nên chúng ta tuyệt đối không chạy Next.js và Postgres trên này. Hãy dùng lệnh sau để chỉ khởi động các component Backend:

```bash
cd infra
docker compose up -d redis vault api admin-worker reminder-worker discord-bot
```

_Lệnh trên sẽ bỏ qua 2 container `web` và `postgres`._

Đợi vài phút để Docker tải image và khởi động. Chạy lệnh `docker ps` để kiểm tra, nếu thấy 6 services báo status `Up` là thành công!

---

## Bước 4: Lấy HTTPS Domain Miễn Phí (Cloudflare Tunnel)

Để Frontend trên Vercel có thể gọi API của bạn, API cần có một Domain HTTPS. Cách dễ nhất không tốn 1 xu mua tên miền là dùng Cloudflare.

1. Đăng ký tài khoản tại [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. Chọn mục **Networks** -> **Tunnels** -> **Create a tunnel**.
3. Chọn **Cloudflared** -> Đặt tên (vd: `eduadvisor-api`) -> Save.
4. Hệ thống sẽ hiện ra một đoạn lệnh cài đặt. Hãy copy đoạn lệnh ở tab **Debian/Ubuntu** và chạy nó trên Terminal của VPS.
5. Sau khi connector báo Connected, bấm **Next**.
6. Ở bước **Public Hostname**:
   - Subdomain: Chọn 1 cái tên (vd: `api-eduadvisor`).
   - Domain: Chọn tên miền miễn phí mà Cloudflare gợi ý (hoặc tên miền bạn add vào).
   - Service Type: Chọn `HTTP`.
   - URL: Điền `localhost:8000` (đây là cổng của FastAPI đang chạy trên VPS).
7. Bấm **Save tunnel**.

🎉 **XONG!** Lúc này, Cloudflare sẽ cấp cho bạn một đường link xịn sò (Ví dụ: `https://api-eduadvisor.trycloudflare.com`).

---

## Bước 5: Kết nối Frontend (Vercel)

Cuối cùng, bạn hãy deploy code Next.js lên Vercel.
Trong phần **Environment Variables** của Vercel, hãy thiết lập biến:
`NEXT_PUBLIC_API_URL = https://api-eduadvisor.trycloudflare.com` (Đường link bạn vừa tạo ở Bước 4).

Lúc này:

- 🌐 **Vercel** gánh Frontend mượt mà.
- 🗄️ **Neon.tech** gánh Database Serverless.
- ☁️ **GCP VPS** chỉ chuyên tâm chạy Bot, Worker và xử lý Logic API siêu ổn định.
  Hệ thống của bạn đã thực sự lên môi trường Production với chi phí **0 đồng**!
