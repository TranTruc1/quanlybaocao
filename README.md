# Sổ Liệu — Next.js + MongoDB

Bản 2.0 giữ giao diện React, vai trò Admin / MKT / SALE, báo cáo, đơn hàng, mục tiêu, phân phối và thông báo. Backend chạy trong Next.js trên Vercel, dữ liệu lưu ở MongoDB Atlas. Không gọi Apps Script khi sử dụng web.

## Chạy ứng dụng

Cần Node.js 22 hoặc 24.

```sh
npm ci
```

Sao chép `.env.example` thành `.env.local`, điền các giá trị thật ở máy của bạn:

```dotenv
MONGODB_URI=mongodb+srv://...
MONGODB_DB=quanlybaocao
SL_AUTH_PEPPER=...
```

Cấu hình kết nối phía server: `config/mongodb.js`. Giao diện gọi `/api/rpc` cùng domain; không có URL MongoDB hoặc mật khẩu trong frontend. Không dùng `SO_LIEU_API_URL` hay `public/config.js` nữa.

```sh
npm run db:setup
npm run dev
```

Database phải hỗ trợ giao dịch nhiều document: dùng Atlas hoặc MongoDB replica set. MongoDB standalone không đủ cho phần chuyển ngân sách.

**Nếu có dữ liệu Sheets:** làm theo `HUONG_DAN_CHUYEN_DU_LIEU.md`, không tạo admin mới trước khi nhập.

**Nếu bắt đầu mới hoàn toàn:** điền `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` (6–20 ký tự) trong `.env.local`, chạy `npm run db:admin`, sau đó xóa ba biến khởi tạo. Không có tài khoản demo mặc định.

## Thay đổi nghiệp vụ

- Chuyển số dư từ sản phẩm này sang nhiều sản phẩm khác trong cùng tài khoản vào ngày báo cáo. Nút **Chuyển ngân sách** → chọn nguồn, đích, số tiền → **Áp dụng vào báo cáo** → **Lưu / Gửi báo cáo**. Tất cả lưu trong một giao dịch.
- Chỉ dùng số dư từ các ngày trước, không dùng tiền mới nhận hoặc tiền vừa nhận từ sản phẩm khác để chuyển tiếp trong cùng ngày. Nếu cần chuyển tiếp, thực hiện ở báo cáo ngày sau. Không tạo thêm tiền khi chuyển.
- Ngân sách khả dụng = dư trước ngày + tiền mới nhận + chuyển đến − chuyển đi. Giữ số dư qua các ngày chưa có báo cáo. Sửa/xóa báo cáo cũ sẽ tính lại các ngày sau; nếu gây thiếu dư cho một khoản chuyển, toàn bộ thao tác bị từ chối và báo ngày cần kiểm tra.
- Báo cáo MKT: Data ktt = Tổng data − Data tương tác; không cho tương tác vượt tổng. Đơn bán hàng và Upsale lấy từ đơn khớp tài khoản, sản phẩm, ngày; chia đơn 0,5 và bùng 0.
- Các báo cáo hiển thị dòng riêng cho bán hàng, Upsale, chăm sóc. Dòng chăm sóc không chứa lại Upsale. Tổng doanh thu chăm trong các chỉ số tổng hợp cũ vẫn gồm chăm sóc + Upsale.
- Admin có thể thêm, sửa, xóa báo cáo của nhân viên; đơn hàng độc lập được giữ lại khi xóa báo cáo. Thao tác có lịch sử và thông báo.
- Nút **Thêm / Yêu cầu báo cáo** cho admin tự mở bảng hoặc yêu cầu nhân viên điền/sửa kèm nội dung. Yêu cầu hiển thị trong chuông và danh sách đang chờ; click mở đúng ngày. Nhân viên được sửa đúng ngày đang được yêu cầu kể cả ngoài 7 ngày. Yêu cầu tự hoàn tất khi báo cáo được lưu.
- Nội dung chưa lưu tiếp tục được giữ khi F5. Phiên đăng nhập 12 giờ dùng cookie HttpOnly; token thật không được lưu trong JavaScript. Mọi API kiểm tra phiên và quyền phía server.

## Triển khai và kiểm tra

Xem `DEPLOY_VERCEL.md` và `REVIEW.md`.

```sh
npm test
npm run build
npm run start
```

`npm run test:integration` tạo MongoDB replica set tạm, kiểm tra ghi đồng thời, rollback và chống ghi trùng. Lệnh này cần môi trường cho phép chạy tiến trình MongoDB và tải binary lần đầu; không truy cập dữ liệu thật.

Đã bỏ backend Apps Script và cấu hình Vite cũ. Giữ `migration/ExportSheets.gs` chỉ để xuất dữ liệu cũ khi cần; web không gọi file này khi hoạt động.

## Cập nhật giao diện báo cáo

Chọn nhân viên bằng icon và tên (MKT / SALE); đổi bộ lọc giữ nguyên nhân viên đang xem. Bảng chi tiết hỗ trợ kéo chuột ngang và thanh lưu cố định. Các số đơn và doanh số cùng loại hiển thị liền nhau. Bỏ danh sách ngày trùng lặp phía dưới, giữ chọn ngày/lịch sử/sửa ngày phía trên.

MKT bấm icon ngay ô Dư chuyển sang để chuyển cho nhiều sản phẩm. Modal chặn tổng chuyển vượt dư trước khi áp dụng; không có bước admin duyệt. Ngân sách khả dụng nằm cạnh tên sản phẩm, Thừa cuối ngày ở hàng đầu. Admin không có nút chuyển tiền trên giao diện xem báo cáo.

Admin có nút Yêu cầu sửa báo cáo tại bảng chi tiết. User nhận modal khi tải trang, khi quay lại tab, hoặc trong khoảng 30 giây nếu đang mở web. Chỉ gọi API thông báo gọn để kiểm tra cập nhật.
