# M7 Bot Integration Guide

Hướng dẫn kết nối bot thật với UIT EduAdvisor sau khi có token từ các platform.

## Trạng thái hiện tại

Code M7 sử dụng **mock mode** mặc định: mọi gửi tin nhắn chỉ ghi log, webhook validation luôn pass. Khi có token, chỉ cần điền `.env` — không cần sửa code.

Tìm tất cả mock markers:
```bash
grep -rn "MOCK_API" apps/api/app/services/bot/ apps/api/app/scripts/
```

## 1. Telegram

### Bước 1: Tạo bot
1. Mở Telegram, chat với [@BotFather](https://t.me/BotFather)
2. Gửi `/newbot`, đặt tên và username
3. Copy token (dạng `123456:ABC-DEF...`)

### Bước 2: Cập nhật .env
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string
```

### Bước 3: Setup webhook
Sau khi deploy, gọi API Telegram để đăng ký webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/v1/bot/telegram/webhook",
    "secret_token": "your-random-secret-string"
  }'
```

### Bước 4: Setup menu commands
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "tkb", "description": "Xem TKB"},
      {"command": "lithi", "description": "Lich thi 7 ngay toi"},
      {"command": "deadline", "description": "Deadline sap toi"},
      {"command": "gpa", "description": "GPA tich luy"},
      {"command": "nhacnho", "description": "Bat/tat nhac nho"},
      {"command": "help", "description": "Danh sach lenh"}
    ]
  }'
```

### Bước 5: Verify
- Gửi `/start` cho bot → nhận hướng dẫn liên kết
- Tạo link token trên web → gửi `/start <token>` → liên kết thành công
- Gửi `/help` → nhận danh sách lệnh

---

## 2. Discord

### Bước 1: Tạo application
1. Vào [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application → đặt tên
3. Bot → Add Bot → copy token
4. OAuth2 → URL Generator → chọn scope `bot` + `applications.commands`
5. Bot Permissions: Send Messages, Use Slash Commands
6. Copy invite URL, mở trong browser để invite bot vào server test

### Bước 2: Cập nhật .env
```env
DISCORD_BOT_TOKEN=your-discord-bot-token
```

### Bước 3: Restart service
```bash
docker compose restart discord-bot
```
Bot sẽ tự đăng ký slash commands khi khởi động.

### Bước 4: Verify
- Trong server Discord, gõ `/help` → nhận danh sách lệnh
- `/link <token>` → liên kết tài khoản

---

## 3. Messenger (Facebook)

### Bước 1: Tạo Facebook App
1. Vào [Meta for Developers](https://developers.facebook.com/)
2. My Apps → Create App → Business → đặt tên
3. Add Product → Messenger → Set Up

### Bước 2: Tạo Page + Token
1. Tạo Facebook Page (hoặc dùng page sẵn)
2. Messenger Settings → Generate Token cho page đó
3. Copy Page Access Token

### Bước 3: Cập nhật .env
```env
MESSENGER_PAGE_ACCESS_TOKEN=your-page-access-token
MESSENGER_VERIFY_TOKEN=your-random-verify-token
MESSENGER_APP_SECRET=your-app-secret
MESSENGER_PAGE_NAME=your-page-name
```

### Bước 4: Setup webhook
1. Messenger Settings → Webhooks → Edit Callback URL
2. URL: `https://your-domain.com/api/v1/bot/messenger/webhook`
3. Verify Token: giá trị `MESSENGER_VERIFY_TOKEN` trong .env
4. Subscribe to: `messages`, `messaging_postbacks`, `messaging_optins`

### Bước 5: Setup Persistent Menu
```bash
curl -X POST "https://graph.facebook.com/v19.0/me/messenger_profile" \
  -H "Content-Type: application/json" \
  -d '{
    "persistent_menu": [{
      "locale": "default",
      "call_to_actions": [
        {"type": "postback", "title": "Xem TKB", "payload": "/tkb"},
        {"type": "postback", "title": "Lich thi", "payload": "/lithi"},
        {"type": "postback", "title": "Deadline", "payload": "/deadline"},
        {"type": "postback", "title": "GPA", "payload": "/gpa"}
      ]
    }]
  }' \
  "https://graph.facebook.com/v19.0/me/messenger_profile?access_token=<TOKEN>"
```

### Bước 6: App Review
> **Quan trọng**: Messenger yêu cầu App Review để gửi tin nhắn cho người dùng ngoài admin/tester.

1. App Review → Request Permissions: `pages_messaging`
2. Chuẩn bị video demo luồng liên kết + gửi lệnh
3. Submit review (có thể mất 1-4 tuần)

### Bước 7: Verify
- Gửi tin nhắn cho Page → nhận reply từ bot
- Click `m.me/PAGE_NAME?ref=<token>` → liên kết tài khoản

---

## Checklist hoàn thành

- [ ] Telegram: token set, webhook registered, commands set, `/start` works
- [ ] Discord: token set, bot invited, slash commands synced, `/help` works
- [ ] Messenger: token set, webhook verified, persistent menu set, App Review submitted
- [ ] Reminder worker: running, sends notifications to all linked platforms
- [ ] Test unlink/relink flow on each platform

## Troubleshooting

**Bot không phản hồi?**
- Kiểm tra logs: `docker compose logs -f api` (Telegram/Messenger) hoặc `docker compose logs -f discord-bot`
- Kiểm tra token: `grep BOT_TOKEN .env`
- Kiểm tra webhook: curl webhook URL thử

**Reminder không gửi?**
- `docker compose logs -f reminder-worker`
- Kiểm tra ReminderPreference trong DB
- Kiểm tra Redis dedup keys: `redis-cli KEYS "reminder:*"`
