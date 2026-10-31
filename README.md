# Filmiliar - E-Commerce Camera Rental & Certified Used Platform
> **Đề tài**: Xây dựng chiến lược kinh doanh và nền tảng thương mại điện tử cho website cho thuê và bán máy ảnh second-hand kiểm định tại TP.HCM (2026 - 2029).  
> **Nhóm thực hiện**: Nhóm 1 - Khóa TMĐT, Đại học Kinh tế TP.HCM (UEH).  
> **Triển khai hiện tại**: Frontend trên **Vercel**, API và PostgreSQL riêng trên **Oracle Cloud VPS**. Tích hợp Media trên Hosting iNet chưa hoàn thiện.

## Trạng thái hiện tại

Frontend có URL riêng cho trang chủ `/`, danh mục thuê `/thue`, danh mục mua `/mua`, chi tiết `/thiet-bi/:slug`, trang xem lại thuê/mua và các trang nội dung `/thong-tin/:topic`. Tại trang xem lại, nút gửi yêu cầu bị khóa: **không tạo đơn, không giữ máy, không thanh toán**. API tạo thanh toán cũng trả 503 theo mặc định. Quy tắc đặt cọc, bảo hành và giao nhận chưa được nhóm chốt.

Luồng ZaloPay QR đã có chế độ **Sandbox chỉ dành cho quản trị viên**, mặc định `PAYMENT_MODE=disabled`. Khi chủ dự án bật rõ ràng chế độ `sandbox` và đặt `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_CALLBACK_URL` trong cấu hình riêng, trang xem lại đơn thuê cho phép quản trị viên thử tạo QR. Mỗi lượt thử giữ một chiếc máy trong dữ liệu, lưu mã giao dịch để truy vấn lại, và chỉ xác nhận đơn sau kết quả ZaloPay hợp lệ. Hết giờ quét QR không tự tạo mã mới hoặc tự kết luận thất bại; hệ thống tiếp tục đối soát. Trang tài khoản và quản trị gắn nhãn các bản ghi Sandbox. Khách hàng vẫn không thể tạo đơn hay thanh toán.

Số cọc trong danh mục là dữ liệu mẫu, không phải chính sách đã duyệt. Chưa áp dụng giảm cọc theo eKYC, chưa mở nhận CCCD, và chưa có thao tác hoàn cọc tự động. `HELD` trong dữ liệu Sandbox chỉ biểu thị kết quả thử nghiệm, không phải tiền thật hoặc khoản ký quỹ được bảo đảm.

Tài khoản có trang `/dang-nhap`, `/dang-ky`, `/tai-khoan`; quản trị viên có `/admin`. Tài khoản mới đăng ký luôn có vai trò khách hàng. Trang tài khoản hỗ trợ sửa hồ sơ, đổi mật khẩu và xem các đơn đã ghi trong cơ sở dữ liệu. Trung tâm quản trị có năm mục: tổng quan, đơn thuê, kho theo serial, đơn mua và thành viên; các danh sách có tìm kiếm/lọc. Quản trị viên có thể thêm máy ở trạng thái bảo dưỡng, sửa bản ghi Passport và chuyển giữa sẵn sàng/bảo dưỡng khi máy không gắn đơn đang mở. Xác nhận đã thu tiền, bàn giao, hoàn cọc, kích hoạt bảo hành, duyệt eKYC và đổi vai trò vẫn khóa ở API cho đến khi có quy trình đối soát và chính sách được duyệt. Hosting ảnh công khai không dùng để nhận giấy tờ định danh thật.

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

Đọc [hướng dẫn CI/CD và vận hành VPS](deploy/README.md) trước khi triển khai. Cấu hình Docker Compose dành riêng cho Filmiliar dùng PostgreSQL riêng, API bind vào `127.0.0.1:3081` trên VPS. Cổng `5000` chỉ là cổng nội bộ container; không dùng PM2 hoặc chiếm `80/443`.

GitHub Actions kiểm tra mỗi pull request vào `main`. Khi push lên `main`, pipeline build client/server, chạy kiểm thử với PostgreSQL tạm, xuất image API lên GHCR rồi triển khai VPS qua SSH riêng. VPS nhận image theo digest, sao lưu DB trước migration và xác minh commit tại `/api/health`. Frontend tiếp tục deploy qua kết nối Git của Vercel; luồng Vercel hoạt động độc lập với job triển khai VPS.

Website: `https://filmiliar.congtc145.id.vn`. API: `https://api-filmiliar.congtc145.id.vn`. Client Vercel đã đặt `VITE_API_BASE_URL` bằng origin API ở cả Production và Preview. Đây là URL công khai trong bundle, không phải khóa bí mật. Project Vercel đã liên kết GitHub và build từ `apps/client`. Tài liệu nhóm và hướng dẫn iNet riêng được giữ trên máy, không đưa lên GitHub.

### Tài khoản quản trị và kiểm tra

Không có mật khẩu mẫu trong mã nguồn hoặc nút tự điền tài khoản. Sau khi build API, quản trị viên có thể tạo tài khoản từ môi trường vận hành bằng `node apps/server/dist/provision-user.js <email> ADMIN <họ tên>`; chương trình đọc mật khẩu dài 20–128 ký tự qua stdin và từ chối ghi đè tài khoản có sẵn. Sinh và nhập mật khẩu trực tiếp trên máy chủ, giữ ngoài repository. Khách hàng có thể tự đăng ký tại `/dang-ky`.

Chạy `npm run test -w apps/server` để kiểm tra cơ chế băm mật khẩu, phiên đăng nhập và vô hiệu hóa phiên cũ sau khi đổi mật khẩu. `npm run build` kiểm tra cả server và client. Khi nâng cấp API từ token cũ sang token hiện tại, người dùng cần đăng nhập lại.

### Kiểm tra ZaloPay Sandbox

`npm run test -w apps/server` còn kiểm tra HMAC tạo đơn, truy vấn và callback bằng khóa thử giả. Bài kiểm tra tranh chấp một chiếc máy, callback lặp, mất phản hồi và đối soát cần PostgreSQL riêng, chỉ chạy khi `PAYMENT_TEST_DATABASE_URL` trỏ đúng database `filmiliar_payment_test`; dùng `npm run test:payment:integration -w apps/server`. Không dùng cơ sở dữ liệu sản xuất để chạy test. Mã nguồn `server.js` ở thư mục gốc chứa khóa riêng, được Git bỏ qua và không được đưa vào commit.
