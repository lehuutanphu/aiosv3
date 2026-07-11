# AI OS ↔ Hermes Proxy

Backend nhỏ giữ API key an toàn và forward request giữa AI OS Dashboard, Hermes Agent (chat), và Mem0 (knowledge). Không dùng gói npm ngoài — chỉ Node.js built-in (`http`, `fetch`), Node ≥ 18.

Xem kiến trúc tổng thể tại [`../HERMES_INTEGRATION.md`](../HERMES_INTEGRATION.md).

## Chạy nhanh (chế độ MOCK — không cần Hermes/Mem0 thật)

```bash
cd project/aios/server
cp .env.example .env
node server.js
```

Mặc định `MOCK_MODE=true` trong `.env.example` — proxy trả lời giả lập để bạn test luồng mà chưa cần Hermes thật đang chạy.

Kiểm tra nhanh:

```bash
curl http://localhost:8787/api/health

curl -X POST http://localhost:8787/api/agents/sales-1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Xin chào"}'

curl -X POST http://localhost:8787/api/agents/fin-1/knowledge \
  -H "Content-Type: application/json" \
  -d '{"text":"Bảng giá mới tháng 7/2026"}'
```

## Chuyển sang chạy thật

1. Hoàn tất Bước 1–4 trong [`HERMES_INTEGRATION.md`](../HERMES_INTEGRATION.md) (tạo Profile, bật API Server từng cổng, cấu hình Mem0).
2. Trong `.env`: đặt `MOCK_MODE=false`, điền từng `HERMES_KEY_*` và `MEM0_API_KEY`.
3. Nếu đổi cổng/tên profile khác bảng mặc định, sửa [`agents.config.json`](agents.config.json) cho khớp.
4. Chạy lại `node server.js`, lặp lại các lệnh `curl` ở trên — lần này phản hồi đến từ Hermes/Mem0 thật (field `"mock": false`).
5. Trong `website/js/app.js`, đặt `USE_REAL_HERMES = true` và `HERMES_PROXY_BASE` trỏ đúng địa chỉ proxy đang chạy.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `PROXY_PORT` | Cổng proxy này lắng nghe (mặc định 8787) |
| `ALLOWED_ORIGIN` | Origin duy nhất được phép gọi (CORS) — đặt đúng domain AI OS Dashboard |
| `MOCK_MODE` | `true` = giả lập, `false` = gọi Hermes/Mem0 thật |
| `HERMES_KEY_<AGENT_ID>` | `API_SERVER_KEY` của từng Hermes Profile, vd `HERMES_KEY_SALES_1` |
| `MEM0_API_KEY` | API key Mem0 dùng chung, phân vùng theo `agent_id` |

## Endpoint

- `GET /api/health` — trạng thái proxy + danh sách agent đã cấu hình.
- `POST /api/agents/:agentId/chat` — body `{ message, history? }` → `{ reply, mock }`.
- `POST /api/agents/:agentId/knowledge` — body `{ text }` → `{ stored, mock }`.
