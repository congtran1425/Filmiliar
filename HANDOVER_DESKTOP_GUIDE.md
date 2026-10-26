# HƯỚNG DẪN BÀN GIAO TIẾP TỤC DỰ ÁN TRÊN MÁY TÍNH MỚI (DESKTOP HANDOVER)

> **Dự án**: Filmiliar — E-Commerce Camera Rental & Certified Used Platform  
> **Repository GitHub**: `https://github.com/congtran1425/Filmiliar.git`  
> **Nhánh làm việc chính**: `main` (Production Vercel) & `feature/admin-management` (Admin Hub & Backend APIs)  
> **Tài liệu lịch sử toàn bộ chat với Antigravity**: Xem chi tiết tại [context/CHAT_CONVERSATION_HISTORY.md](context/CHAT_CONVERSATION_HISTORY.md)  
> **Tài liệu lịch sử toàn bộ chat với Codex**: Xem chi tiết tại [context/CODEX_CONVERSATION_HISTORY.md](context/CODEX_CONVERSATION_HISTORY.md)  

---

## 1. THIẾT LẬP NHANH KHI KÉO CODE VỀ MÁY DESKTOP

Khi bạn clone hoặc pull code về máy tính mới, thực hiện các bước sau:

```bash
# 1. Clone repository (nếu chưa clone)
git clone https://github.com/congtran1425/Filmiliar.git
cd Filmiliar

# 2. Cài đặt toàn bộ dependencies
npm install

# 3. Tạo file môi trường cho Backend nếu chưa có (apps/server/.env)
# Tham khảo cấu hình local:
# PORT=5000
# DATABASE_URL="postgresql://filmiliar:YOUR_PASSWORD@localhost:5432/filmiliar?schema=public"
# JWT_SECRET="filmiliar-local-jwt-secret-at-least-32-characters"
# CORS_ORIGIN="http://localhost:5173,https://filmiliar.congtc145.id.vn"

# 4. Kiểm tra build và test
npm run build -w apps/server
npm run test -w apps/server

# 5. Chạy môi trường Dev song song cả Client và Server:
npm run dev
# -> Client: http://localhost:5173
# -> Server: http://localhost:5000
```

---

## 2. TÀI KHOẢN MẪU DÙNG THỬ (SEED DATA)

Trong database (đã seed qua `apps/server/prisma/seed.ts`):
* **Tài khoản Quản trị viên (Admin Hub)**:
  * Email: `admin@filmiliar.vn`
  * Mật khẩu: `FilmiliarAdmin@2026`
  * Quyền: `Role.ADMIN`, eKYC: `VERIFIED`
* **Tài khoản Khách hàng (Customer)**:
  * Email: `khachhang@filmiliar.vn`
  * Mật khẩu: `FilmiliarUser@2026`
  * Quyền: `Role.CUSTOMER`, eKYC: `VERIFIED`

---

## 3. TRẠNG THÁI HIỆN TẠI CỦA CÁC PHÂN HỆ

1. **Hạ tầng triển khai**:
   * **Frontend**: Triển khai trên **Vercel** (`https://filmiliar.congtc145.id.vn`), tự động deploy từ nhánh `main` (Root: `apps/client`).
   * **Backend**: Triển khai trên **Oracle Cloud VPS** (Docker Compose `filmiliar`, chỉ bind vào `127.0.0.1:3081` qua Nginx `https://api-filmiliar.congtc145.id.vn`). Đảm bảo an toàn không xung đột với các dự án khác trên VPS (port 3080, 9001...).

2. **Backend APIs (Đã hoàn thiện & 100% Tests Passed)**:
   * **Auth & Session**: HMAC versioned tokens, tự thu hồi session khi đổi mật khẩu (`apps/server/src/auth.ts`).
   * **ZaloPay Sandbox**: VietQR, truy vấn trạng thái, MAC verification (`apps/server/src/services/zalopay.service.ts`).
   * **Admin Hub Operations (5 phân hệ cốt lõi)**:
     - `GET /api/admin/stats`: KPIs khai thác kho máy, tổng quỹ cọc HELD/REFUNDED/DEDUCTED, cảnh báo đến hạn/quá hạn/eKYC chờ duyệt.
     - `GET /api/admin/bookings` & `PATCH /api/admin/bookings/:id/status`: Bàn giao xuất kho (`ACTIVE_RENTAL` -> khóa máy `RENTED`), nghiệm thu kỹ thuật (số shot, cảm biến, thấu kính), hoàn cọc 100% (`REFUNDED` -> trả máy `AVAILABLE`) hoặc lập biên bản khấu trừ (`DEDUCTED`).
     - `GET /api/admin/inventory`, `POST /api/admin/inventory`, `PATCH /api/admin/inventory/:serial`: Quản lý kho máy vật lý & Technical Passport.
     - `GET /api/admin/orders` & `PATCH /api/admin/orders/:id/status`: Đơn mua máy cũ, kích hoạt bảo hành 6 tháng (`warrantyExpiresAt = +180 ngày`) và chuyển máy sang `SOLD`.
     - `GET /api/admin/users`, `PATCH /api/admin/users/:id/kyc`, `PATCH /api/admin/users/:id/role`: Thẩm định CCCD eKYC và phân quyền.

3. **Frontend Client**:
   * UI Mobile/Desktop theo phong cách Dark Film sang trọng.
   * Quản trị viên đăng nhập bằng `admin@filmiliar.vn` sẽ có nút **"Admin Hub"** trên thanh điều hướng mở `/admin`.

---

## 4. DANH MỤC THIẾT BỊ MỚI & HƯỚNG DẪN MEDIA HOSTING (26/10/2026)

1. **Danh mục 10 Thân máy Mirrorless + 4 Ống kính mới**:
   - Đã đồng bộ từ file `Model.docx` và thư mục ảnh `Mirrorless`.
   - Sản phẩm `Sony Alpha A7 III` đã được chuyển đổi thành `Canon EOS M50` với mức giá thị trường tối ưu (Gốc: 14.5tr, Thuê: 170k/ngày, Cũ: 10tr, Cọc: 1.5tr).
   - Đã tạo sẵn 16 bản ghi con máy `CameraItem` (Technical Passport với số serial, số shot, tình trạng kính, cảm biến và tiền cọc) trong `apps/server/prisma/seed.ts`.
   - Frontend đã hỗ trợ bộ chọn xem chi tiết đa góc chụp: Tổng thể, Mặt trước, Mặt sau, Mặt trên (`apps/client/src/pages/ProductPage.tsx`).

2. **Cách đưa gói ảnh lên hosting `media.congtc145.id.vn`**:
   - File nén đã chuẩn hóa: `filmiliar-media-bundle.zip` (nằm ở thư mục `Downloads`).
   - Mở File Manager của hosting iNet (`media.congtc145.id.vn`), tải file zip lên thư mục web gốc (`public_html/`) và bấm **Extract (Giải nén)**.
   - Thư mục ảnh cục bộ dự phòng cũng đã được tích hợp sẵn tại `apps/client/public/images/products/`.

---

## 5. CÁC ĐẦU VIỆC TIẾP THEO KHI LÀM VIỆC TRÊN DESKTOP

1. **Cho Codex**: Hoàn thiện hiển thị mã VietQR trên modal thanh toán client (`apps/client/src/pages/ReviewPage.tsx` và `services/payment-flow.ts`).
2. **Cho Client Admin Hub**: Kết nối các nút bấm trên giao diện `apps/client/src/pages/AdminPage.tsx` vào các API Backend tương ứng vừa hoàn thành.
3. **Cập nhật lên VPS**: SSH vào VPS, `cd /opt/apps/filmiliar/repo && git pull origin main && bash deploy/deploy-shared-vps.sh` và chạy seed dữ liệu mới `npx prisma db seed`.
