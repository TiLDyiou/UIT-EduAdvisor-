# UIT EduAdvisor

Cố vấn học vụ All-in-one cho sinh viên UIT. Nền móng + bảo mật + onboarding thật cho 6 phân hệ trong [docs/UIT_EduAdvisor_PRD_v3.md](docs/UIT_EduAdvisor_PRD_v3.md).

> Trạng thái: **M2 Onboarding (đang triển khai)**. API `/api/v1` gồm captcha + đăng nhập DAA thật, session sinh viên (cookie httpOnly + Redis), đồng bộ DAA/Moodle nền, SSE tiến trình, xóa credential/dữ liệu. Cần `make migrate` để áp Alembic `0006`. Frontend: `/onboarding`, `/settings` (Next.js rewrite `/api/v1` về FastAPI để cookie cùng origin). Xem [.cursor/plans/](.cursor/plans/) cho roadmap.

Legal text (consent versions): [docs/legal/privacy_v1.md](docs/legal/privacy_v1.md), [docs/legal/tos_v1.md](docs/legal/tos_v1.md). Constants trong API: `app.core.legal.POLICY_VERSION` / `TOS_VERSION`.

## Kiến trúc

```
apps/web (Next.js 15)  ──┐
                          ├─→ apps/api (FastAPI) ──→ Postgres + pgvector
                          │                       ──→ Redis
                          │                       ──→ Vault (Transit)
```

Tất cả service chạy bằng Docker Compose. Local development không cần cài Postgres / Redis / Vault trên máy.

## Yêu cầu hệ thống

- Docker 24+ với Docker Compose v2 (`docker compose`, không phải `docker-compose`).
- Make (đã có sẵn trên Linux/macOS).
- Cho dev mode (test/lint host-side): Python 3.12, Node 20.

## Khởi động lần đầu

```bash
# 1. Tạo .env từ template (tự động bỏ qua nếu đã có)
make env

# 2. Build và khởi động toàn bộ stack
make up

# 3. Chạy DB migration (tạo extension pgvector)
make migrate

# 4. Verify tất cả service healthy
make ps
```

Sau khi chạy, kiểm tra:

| Endpoint                                  | Mong đợi                                  |
| ----------------------------------------- | ----------------------------------------- |
| `curl http://localhost:8000/healthz`      | `{"status":"ok"}`                         |
| `curl http://localhost:8000/readyz`       | `{"status":"ok","checks":{...}}` HTTP 200 |
| `curl http://localhost:3000/api/health`   | `{"status":"ok"}`                         |
| Mở `http://localhost:3000` trong browser  | Trang skeleton dark mode                  |
| `curl http://localhost:8000/docs`         | Swagger UI (chỉ trong local/staging)      |

## Lệnh thường dùng

```bash
make help          # liệt kê tất cả target
make up            # build + start
make down          # stop (giữ volume)
make down-volumes  # stop + wipe DB (destructive)
make logs          # tail logs
make psql          # mở psql shell
make migrate       # alembic upgrade head
make revision m="add students table"  # alembic revision --autogenerate
make test          # pytest + vitest
make lint          # ruff + eslint + tsc
make format        # ruff format + autofix
```

## Cấu trúc thư mục

```
apps/
  api/                  # FastAPI backend
    app/                  # source code
      core/                 # config, logging, lifespan
      api/                  # route handlers (health hiện tại)
      db/                   # SQLAlchemy session + base
    alembic/              # migrations
    tests/                # pytest
  web/                  # Next.js 15 (App Router)
    app/                  # routes & pages
    lib/                  # env validation, helpers
    tests/                # vitest
infra/
  docker-compose.yml             # base
  docker-compose.override.yml    # local dev overrides
  postgres/init.sql              # pgvector extension on volume init
.github/workflows/ci.yml         # lint + test + docker build
.env.example
Makefile
```

## Cấu hình môi trường

Single source of truth: file `.env` ở root, được load bởi cả `docker compose` (qua `--env-file`) và Pydantic Settings của FastAPI. Xem [.env.example](.env.example) cho tất cả biến.

Các giá trị `*_HOST` (ví dụ `POSTGRES_HOST=postgres`) là **service name** trong Docker network. Khi chạy code trên host (ví dụ `make test-api` trực tiếp), cần override sang `localhost`.

## Cảnh báo bảo mật M1

- **Vault vẫn dev-mode** trong compose hiện tại: tự unseal, in-memory, restart là mất Transit keys (trừ khi dev root token + workflow bootstrap lại). **Trước khi M2 cho onboarding production**, phải chuyển Vault sang production mode (file/raft backend + unseal có quy trình, runbook M8). Wrapper Transit trong code chỉ đảm bảo encrypt/decrypt đúng khi Vault đang chạy; không đảm bảo persistence qua restart trong dev-mode.
- **`.env` chứa secret thật khi deploy**: không commit. Đã có trong `.gitignore`. Trên VPS cần `chmod 600`.
- **Không có HTTPS / reverse proxy ở M0**: ports expose trực tiếp localhost. Sẽ thêm Caddy ở M8.

## Test & lint cục bộ

Test/lint chạy trên host (không qua container) để nhanh hơn và parity với IDE.

**API pytest (M1+)**: một phần test dùng [testcontainers](https://testcontainers.com/) (Postgres pgvector, Vault dev, Redis). Máy dev và CI cần **Docker** đang chạy (`docker ps` ok).

```bash
make install        # tạo venv (api) + node_modules (web). Lần đầu mất vài phút.
make test           # pytest + vitest
make lint           # ruff + eslint + tsc --noEmit
```

## CI

GitHub Actions chạy trên mọi push/PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)):

1. Lint + typecheck cho web và api
2. Unit test cho cả hai
3. Build Docker image cho cả hai (verify Dockerfile chạy được; KHÔNG push)

CI chưa push image lên registry. Sẽ thêm khi có domain + VPS production (M8).

## Roadmap

Xem [.cursor/plans/production_roadmap_80636c8e.plan.md](.cursor/plans/production_roadmap_80636c8e.plan.md) cho 9 milestone đầy đủ. Sau M1 (schema + Transit + consent/audit/rate-limit nền), M2 là authentication và onboarding sinh viên.
