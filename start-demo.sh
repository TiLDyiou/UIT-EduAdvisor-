#!/bin/bash
# =============================================================
# 🚀 UIT EduAdvisor — Script khởi động Demo
# Chạy lệnh: bash start-demo.sh
# =============================================================

set -e

# Load Node.js (fnm)
eval "$(~/.local/share/fnm/fnm env)"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo ""
echo "🎓 ========================================"
echo "   UIT EduAdvisor — Khởi động Demo"
echo "========================================"
echo ""

# --- Bước 1: Tắt tiến trình cũ (nếu có) ---
echo "Dọn dẹp tiến trình cũ..."
fuser -k 8000/tcp 2>/dev/null || true
sleep 1

# --- Bước 2: Khởi động Backend ---
echo "Khởi động Backend (port 8000)..."
cd "$BACKEND_DIR"
uv run uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 3

# Kiểm tra backend
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend không khởi động được!"
    exit 1
fi
echo "Backend đang chạy (PID: $BACKEND_PID)"

# --- Bước 3: Mở Localtunnel ---
echo "Đang tạo link public (Localtunnel)..."
npx -y localtunnel --port 8000 >/tmp/lt_output.txt 2>&1 &
LT_PID=$!
sleep 5

# Lấy URL từ output
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.loca\.lt' /tmp/lt_output.txt | head -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Không lấy được link Localtunnel!"
    echo "   Output: $(cat /tmp/lt_output.txt)"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo "Link public: $TUNNEL_URL"

# --- Bước 4: Cập nhật Vercel và Redeploy ---
echo ""
echo "Cập nhật Vercel với link Backend mới..."
cd "$FRONTEND_DIR"
vercel env rm NEXT_PUBLIC_API_URL production -y 2>/dev/null || true
echo "$TUNNEL_URL" | vercel env add NEXT_PUBLIC_API_URL production 2>/dev/null
echo "Đã cập nhật biến môi trường"

echo "Đang deploy lên Vercel..."
vercel deploy --prod 2>&1 | tail -3

echo ""
echo "========================================"
echo "   DEMO SẴN SÀNG!"
echo "========================================"
echo ""
echo "    Link Demo:  https://demo-web-app-tan.vercel.app"
echo "     Backend:    $TUNNEL_URL"
echo "    Local:      http://localhost:3000"
echo ""
echo "     GIỮ CỬA SỔ TERMINAL NÀY MỞ!"
echo "   Nhấn Ctrl+C để tắt demo."
echo "========================================"
echo ""

# --- Giữ script chạy, tắt sạch khi Ctrl+C ---
cleanup() {
    echo ""
    echo "Đang tắt demo..."
    kill $LT_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    fuser -k 8000/tcp 2>/dev/null || true
    echo "Đã tắt tất cả. Hẹn gặp lại!"
}
trap cleanup EXIT

# Chờ cho đến khi user nhấn Ctrl+C
wait
