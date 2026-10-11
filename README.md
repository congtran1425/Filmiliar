# Filmiliar - E-Commerce Camera Rental & Certified Used Platform
> **Đề tài**: Xây dựng chiến lược kinh doanh và nền tảng thương mại điện tử cho website cho thuê và bán máy ảnh second-hand kiểm định tại TP.HCM (2026 - 2029).  
> **Nhóm thực hiện**: Nhóm 1 - Khóa TMĐT, Đại học Kinh tế TP.HCM (UEH).  
> **Triển khai hiện tại (11/10/2026)**: Frontend trên **Vercel**, API và PostgreSQL riêng trên **Oracle Cloud VPS**. Tích hợp Media trên Hosting iNet chưa hoàn thiện.

## Trạng thái hiện tại

Frontend có URL riêng cho trang chủ `/`, danh mục thuê `/thue`, danh mục mua `/mua`, chi tiết `/thiet-bi/:slug`, trang xem lại thuê/mua và các trang nội dung `/thong-tin/:topic`. Tại trang xem lại, nút gửi yêu cầu bị khóa: **không tạo đơn, không giữ máy, không thanh toán**. API tạo thanh toán cũng trả 503 theo mặc định. Quy tắc đặt cọc, bảo hành và giao nhận chưa được nhóm chốt.

Ảnh trong dữ liệu seed chỉ là ảnh minh họa và nhiều ảnh không đúng mẫu thiết bị; các ảnh sai chủ đề đã được ẩn ở frontend. Khi API không sẵn sàng, frontend hiển thị hai sản phẩm mẫu có nhãn rõ để xem trước UI. Dữ liệu tình trạng từ seed chưa phải Passport có bằng chứng kiểm định.

`apps/client/src/App.tsx` và một số modal thuê/chi tiết/nội dung là mã giao diện cũ, hiện không được gắn vào luồng trang mới. Điểm vào đang dùng là `apps/client/src/SiteApp.tsx`. URL sản phẩm mở trực tiếp trên domain Vercel đã được kiểm tra trả 200.

---

## 1. CẤU TRÚC MONOREPO

```text
Filmiliar/
├── .agents/skills/                   # 4 bộ kỹ năng chuẩn (Hallmark, Vercel React, Supabase Postgres, Security)
├── apps/
│   ├── client/                       # React 18 + Vite + Tailwind CSS + Framer Motion (Deploy Vercel)
│   └── server/                       # Express.js + TypeScript + Prisma ORM (nội bộ container: 5000)
├── docs/
│   └── filmiliar_implementation_plan.md
└── package.json
```

---

## 2. HƯỚNG DẪN CHẠY DỰ ÁN CỤC BỘ (LOCAL DEV)

### Yêu cầu môi trường
* Node.js v18 trở lên (đã kiểm tra tương thích Node.js v24).
* npm v9+.

### Cài đặt
```bash
npm install
```

### Chạy đồng thời cả Frontend và Backend
```bash
# Terminal 1: Chạy Backend (Port 5000)
npm run dev:server

# Terminal 2: Chạy Frontend (Port 5173)
npm run dev:client

# Hoặc chạy cả 2 cùng lúc:
npm run dev
```

* **Frontend Web App**: `http://localhost:5173`
* **Backend API Health Check**: `http://localhost:5000/api/health`
* **Danh mục máy ảnh & Technical Passport**: `http://localhost:5000/api/cameras`

---

## 3. TRIỂN KHAI

Đọc [hướng dẫn VPS và Vercel](docs/deployment_shared_vps.md) trước khi triển khai. Cấu hình Docker Compose dành riêng cho Filmiliar dùng PostgreSQL riêng, API bind vào `127.0.0.1:3081` trên VPS. Cổng `5000` chỉ là cổng nội bộ container; không dùng PM2 hoặc chiếm `80/443`.

Website: `https://filmiliar.congtc145.id.vn`. API: `https://api-filmiliar.congtc145.id.vn`. Client Vercel đã đặt `VITE_API_BASE_URL` bằng origin API ở cả Production và Preview. Đây là URL công khai trong bundle, không phải khóa bí mật. Chưa kết nối GitHub với project Vercel; khi kết nối monorepo cần chọn thư mục gốc `apps/client`. Tài liệu nhóm và hướng dẫn iNet riêng được giữ trên máy, không đưa lên GitHub.
